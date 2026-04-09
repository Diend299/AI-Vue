import argparse
import io
import json
import os
import time
import urllib.parse
import urllib.request
from datetime import datetime

import redis
import requests
from PIL import Image

# === 与 Java 后端 TaskService 对齐 ===
# Redis: leftPush("comfyui_tasks", JSON) -> taskId, prompt, inputPath
# 输入目录: D:/aip_storage/inputs/{taskId}_input.png
# 输出目录: D:/aip_storage/outputs/{taskId}_output.png（可与前端用固定前缀拼接成 URL）
REDIS_HOST = os.environ.get("REDIS_HOST", "localhost")
REDIS_PORT = int(os.environ.get("REDIS_PORT", "6379"))
QUEUE_NAME = os.environ.get("REDIS_QUEUE", "comfyui_tasks")
STATUS_PREFIX = os.environ.get("TASK_STATUS_PREFIX", "task_status:")

INPUT_ROOT = os.environ.get("AIP_INPUT_ROOT", r"D:\aip_storage\inputs")
OUTPUT_ROOT = os.environ.get("AIP_OUTPUT_ROOT", r"D:\aip_storage\outputs")

# MySQL：与 Spring application.yml 一致，可用环境变量覆盖（Worker 直接回写 ai_tasks）
MYSQL_HOST = os.environ.get("MYSQL_HOST", "localhost")
MYSQL_PORT = int(os.environ.get("MYSQL_PORT", "3306"))
MYSQL_USER = os.environ.get("MYSQL_USER", "root")
MYSQL_PASSWORD = os.environ.get("MYSQL_PASSWORD", "root123456")
MYSQL_DB = os.environ.get("MYSQL_DB", "aip_db")

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)


def _get_db():
    import pymysql

    return pymysql.connect(
        host=MYSQL_HOST,
        port=MYSQL_PORT,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        database=MYSQL_DB,
        charset="utf8mb4",
        autocommit=True,
    )


def output_path_for_task(task_id: str) -> str:
    """与 Java 保存的 {taskId}_input.png 对应，输出为 {taskId}_output.png。"""
    os.makedirs(OUTPUT_ROOT, exist_ok=True)
    return os.path.join(OUTPUT_ROOT, f"{task_id}_output.png")


def to_url_path(local_path: str) -> str:
    """前端可用「固定前缀 + 相对路径」拼接；此处提供一种 file URL 形式备用。"""
    norm = os.path.normpath(local_path).replace("\\", "/")
    if norm.startswith("/"):
        return f"file://{norm}"
    return f"file:///{norm}"


def db_update_processing(task_id: str, node_id: str) -> None:
    sql = (
        "UPDATE ai_tasks SET status = %s, node_id = %s WHERE task_id = %s"
    )
    try:
        conn = _get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(sql, ("PROCESSING", node_id, task_id))
        finally:
            conn.close()
    except Exception as e:
        print(f"[DB] PROCESSING 更新失败 task_id={task_id}: {e}")


def db_update_done(task_id: str, result_path: str, node_id: str, cost_time: int) -> None:
    sql = (
        "UPDATE ai_tasks SET status = %s, result_path = %s, node_id = %s, "
        "cost_time = %s, finish_time = %s, error_msg = NULL WHERE task_id = %s"
    )
    try:
        conn = _get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    sql,
                    ("DONE", result_path, node_id, cost_time, datetime.now(), task_id),
                )
        finally:
            conn.close()
    except Exception as e:
        print(f"[DB] DONE 更新失败 task_id={task_id}: {e}")


def db_update_error(task_id: str, error_msg: str, node_id: str) -> None:
    sql = (
        "UPDATE ai_tasks SET status = %s, error_msg = %s, node_id = %s, finish_time = %s WHERE task_id = %s"
    )
    try:
        conn = _get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(sql, ("ERROR", error_msg[:2000], node_id, datetime.now(), task_id))
        finally:
            conn.close()
    except Exception as e:
        print(f"[DB] ERROR 更新失败 task_id={task_id}: {e}")


class ComfyWorker:
    def __init__(self, worker_id, comfy_url):
        self.worker_id = worker_id
        self.comfy_url = comfy_url  # 例如: "127.0.0.1:8188"

    def _build_url(self, path):
        base_url = self.comfy_url.rstrip("/")
        if not base_url.startswith("http://") and not base_url.startswith("https://"):
            base_url = "http://" + base_url
        return f"{base_url}/{path.lstrip('/')}"

    def upload_image(self, image_path):
        with open(image_path, "rb") as f:
            files = {"image": f}
            url = self._build_url("/upload/image")
            res = requests.post(url, files=files)
            if res.status_code == 200:
                return res.json()["name"]
            raise Exception(f"上传失败, 状态码: {res.status_code}")

    def queue_prompt(self, workflow):
        if "prompt" in workflow:
            payload = workflow
        else:
            payload = {"prompt": workflow}

        data = json.dumps(payload).encode("utf-8")
        url = self._build_url("/prompt")
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "ComfyUI-Worker/1.0",
        }
        print(f"DEBUG queue_prompt payload keys: {list(payload.keys())}, endpoint={url}")
        req = urllib.request.Request(url, data=data, headers=headers, method="POST")
        response = urllib.request.urlopen(req)
        return json.loads(response.read())

    def get_history(self, prompt_id):
        url = self._build_url(f"/history/{prompt_id}")
        req = urllib.request.Request(url)
        response = urllib.request.urlopen(req)
        return json.loads(response.read())

    def fetch_image(self, filename, subfolder, folder_type):
        data = {"filename": filename, "subfolder": subfolder, "type": folder_type}
        url_values = urllib.parse.urlencode(data)
        url = self._build_url(f"/view?{url_values}")
        req = urllib.request.Request(url)
        return urllib.request.urlopen(req).read()

    def process_task(self, task_id, prompt, image_path):
        print(f"[{self.worker_id}] 👷 抢到任务 [{task_id}]，分配至节点 [{self.comfy_url}]...")
        t0 = time.time()

        db_update_processing(task_id, self.worker_id)
        r.set(
            f"{STATUS_PREFIX}{task_id}",
            json.dumps(
                {
                    "status": "PROCESSING",
                    "msg": f"由 {self.worker_id} 节点生成中...",
                    "taskId": task_id,
                },
                ensure_ascii=False,
            ),
        )

        try:
            if not os.path.isfile(image_path):
                raise FileNotFoundError(f"参考图不存在: {image_path} (期望在 {INPUT_ROOT} 下)")

            stats_url = self._build_url("/system_stats")
            requests.get(stats_url, timeout=5)

            is_local = "localhost" in self.comfy_url or "127.0.0.1" in self.comfy_url

            if is_local:
                workflow_file = os.path.join(SCRIPT_DIR, "workflow_yinlin.json")
                prompt_node = "20"
                image_node = "37"
                base_prompt = "score_9, score_8, score_7, masterpiece, best quality, "
                is_text_field = "string"
            else:
                workflow_file = os.path.join(SCRIPT_DIR, "workflow_yinlin2.json")
                prompt_node = "3"
                image_node = "17"
                base_prompt = (
                    "masterpiece,best quality,amazing quality,very aesthetic,absurdres,newest,scenery, 1girl, yinlinx, echoset1 outfit, purple eyes,long hair, ponytail,  red hair, circle facial mark, hairband, upper body, floating hair, colorful theme, evil smile, closed mouth, relaxed eyes, hand up, japanese lantern, portrait, dynamic pose,  magical atmosphere, swirling energy, light waves, sparkling particles,paper lantern,mountain, dynamic lighting, ambient light,"
                )
                is_text_field = "text"

            with open(workflow_file, "r", encoding="utf-8") as f:
                workflow = json.load(f)
            uploaded_filename = self.upload_image(image_path)

            if is_local:
                workflow[prompt_node]["inputs"][is_text_field] = base_prompt + prompt
                workflow[image_node]["inputs"]["image"] = uploaded_filename
            else:
                workflow["prompt"][prompt_node]["inputs"][is_text_field] = base_prompt + prompt
                workflow["prompt"][image_node]["inputs"]["image"] = uploaded_filename

            print(f"[{self.worker_id}] 📤 发送 workflow 到 {self.comfy_url}/prompt")
            try:
                prompt_res = self.queue_prompt(workflow)
                prompt_id = prompt_res["prompt_id"]
                print(f"[{self.worker_id}] ✅ 任务提交成功，prompt_id: {prompt_id}")
            except Exception as e:
                print(f"[{self.worker_id}] ❌ queue_prompt 失败: {e}")
                raise

            while True:
                history = self.get_history(prompt_id)
                if prompt_id in history:
                    break
                time.sleep(2)

            outputs = history[prompt_id]["outputs"]
            image_info = list(outputs.values())[-1]["images"][0]
            img_bytes = self.fetch_image(
                image_info["filename"],
                image_info.get("subfolder", ""),
                image_info["type"],
            )

            final_img = Image.open(io.BytesIO(img_bytes))
            result_path = output_path_for_task(task_id)
            final_img.save(result_path)

            cost_time = int(time.time() - t0)
            db_update_done(task_id, result_path, self.worker_id, cost_time)

            result_url_hint = to_url_path(result_path)
            rel_name = os.path.basename(result_path)
            r.set(
                f"{STATUS_PREFIX}{task_id}",
                json.dumps(
                    {
                        "status": "DONE",
                        "msg": f"生成成功 ({self.worker_id})",
                        "taskId": task_id,
                        "resultPath": result_path,
                        "resultUrl": result_url_hint,
                        "relativeOutput": rel_name,
                        "progress": 1.0,
                    },
                    ensure_ascii=False,
                ),
            )
            r.expire(f"{STATUS_PREFIX}{task_id}", 86400)
            print(f"[{self.worker_id}] 🎉 任务 [{task_id}] 完成，已写入 DB 与 Redis，输出: {result_path}")

        except Exception as e:
            print(f"[{self.worker_id}] ❌ 任务 [{task_id}] 失败: {e}")
            err_text = str(e)
            db_update_error(task_id, err_text, self.worker_id)
            r.set(
                f"{STATUS_PREFIX}{task_id}",
                json.dumps(
                    {
                        "status": "ERROR",
                        "msg": f"节点 {self.worker_id} 报错: {err_text}",
                        "taskId": task_id,
                        "errorMsg": err_text,
                    },
                    ensure_ascii=False,
                ),
            )

    def run(self):
        print(f"🚀 Worker [{self.worker_id}] 启动，监听队列 [{QUEUE_NAME}]，Redis={REDIS_HOST}:{REDIS_PORT}")
        os.makedirs(OUTPUT_ROOT, exist_ok=True)

        while True:
            # BRPOP：从右侧弹出，与 Java leftPush 形成 FIFO；取成功后消息即出队
            task = r.brpop(QUEUE_NAME, timeout=0)
            if not task:
                continue
            task_data = json.loads(task[1])

            tid = task_data.get("taskId")
            pmp = task_data.get("prompt")
            pth = task_data.get("inputPath")

            if tid and pmp and pth:
                self.process_task(tid, pmp, pth)
            else:
                print(f"⚠️ 收到格式错误的无效任务（需 taskId, prompt, inputPath）: {task_data}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="分布式生图 Worker（对接 Java + Redis + MySQL）")
    parser.add_argument("--id", type=str, required=True, help="Worker 标识 (写入 node_id)，如 Local_4060")
    parser.add_argument("--url", type=str, required=True, help="ComfyUI 地址，如 127.0.0.1:8188")
    args = parser.parse_args()

    worker = ComfyWorker(args.id, args.url)
    worker.run()
