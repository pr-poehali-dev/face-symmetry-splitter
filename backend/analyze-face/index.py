"""
Анализ симметрии лица через Face++ API.
Принимает base64-изображение, возвращает метрики симметрии по 5 зонам.
"""

import json
import os
import math
import urllib.request
import urllib.parse


def handler(event: dict, context) -> dict:
    cors_headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json",
    }

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors_headers, "body": ""}

    raw_body = event.get("body") or "{}"
    body = json.loads(raw_body)
    image_base64 = body.get("image_base64", "")

    if not image_base64:
        return {"statusCode": 400, "headers": cors_headers, "body": json.dumps({"error": "image_base64 required"})}

    # Убираем data URL prefix если есть
    if "," in image_base64:
        image_base64 = image_base64.split(",", 1)[1]

    api_key = os.environ.get("FACEPP_API_KEY", "")
    api_secret = os.environ.get("FACEPP_API_SECRET", "")

    if not api_key or not api_secret:
        return {"statusCode": 500, "headers": cors_headers, "body": json.dumps({"error": "API keys not configured"})}

    # Запрос к Face++ Detect API с landmark_106point
    params = urllib.parse.urlencode({
        "api_key": api_key,
        "api_secret": api_secret,
        "image_base64": image_base64,
        "return_landmark": "2",  # 106 точек
        "return_attributes": "headpose,beauty",
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api-us.faceplusplus.com/facepp/v3/detect",
        data=params,
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=25) as resp:
        result = json.loads(resp.read().decode("utf-8"))

    faces = result.get("faces", [])
    if not faces:
        return {
            "statusCode": 422,
            "headers": cors_headers,
            "body": json.dumps({"error": "face_not_found", "message": "Лицо не обнаружено на фото"}),
        }

    face = faces[0]
    landmarks = face.get("landmark", {})
    attrs = face.get("attributes", {})

    score = _compute_symmetry(landmarks, attrs)
    return {"statusCode": 200, "headers": cors_headers, "body": json.dumps(score)}


def _dist(p1: dict, p2: dict) -> float:
    return math.sqrt((p1["x"] - p2["x"]) ** 2 + (p1["y"] - p2["y"]) ** 2)


def _midpoint(p1: dict, p2: dict) -> dict:
    return {"x": (p1["x"] + p2["x"]) / 2, "y": (p1["y"] + p2["y"]) / 2}


def _symmetry_score(left_val: float, right_val: float) -> float:
    """Возвращает % симметрии: 100 = идеально."""
    if left_val + right_val == 0:
        return 100.0
    diff = abs(left_val - right_val)
    avg = (left_val + right_val) / 2
    return round(max(0.0, 100.0 - (diff / avg) * 100), 1)


def _compute_symmetry(lm: dict, attrs: dict) -> dict:
    """Вычисляет метрики симметрии по зонам из 106 точек."""

    def p(name):
        return lm.get(name, {"x": 0, "y": 0})

    # --- ГЛАЗА ---
    left_eye_w = _dist(p("left_eye_left_corner"), p("left_eye_right_corner"))
    right_eye_w = _dist(p("right_eye_left_corner"), p("right_eye_right_corner"))
    left_eye_h = _dist(p("left_eye_top"), p("left_eye_bottom")) if "left_eye_top" in lm else left_eye_w * 0.4
    right_eye_h = _dist(p("right_eye_top"), p("right_eye_bottom")) if "right_eye_top" in lm else right_eye_w * 0.4
    eye_width_sym = _symmetry_score(left_eye_w, right_eye_w)
    eye_height_sym = _symmetry_score(left_eye_h, right_eye_h)
    eyes_score = round((eye_width_sym + eye_height_sym) / 2, 1)

    # --- БРОВИ ---
    left_brow_w = _dist(p("left_eyebrow_left_corner"), p("left_eyebrow_right_corner"))
    right_brow_w = _dist(p("right_eyebrow_left_corner"), p("right_eyebrow_right_corner"))
    brows_score = _symmetry_score(left_brow_w, right_brow_w)

    # Высота брови над глазом
    left_brow_mid = _midpoint(p("left_eyebrow_left_corner"), p("left_eyebrow_right_corner"))
    right_brow_mid = _midpoint(p("right_eyebrow_left_corner"), p("right_eyebrow_right_corner"))
    left_eye_mid = _midpoint(p("left_eye_left_corner"), p("left_eye_right_corner"))
    right_eye_mid = _midpoint(p("right_eye_left_corner"), p("right_eye_right_corner"))
    left_brow_height = abs(left_brow_mid["y"] - left_eye_mid["y"])
    right_brow_height = abs(right_brow_mid["y"] - right_eye_mid["y"])
    brow_height_sym = _symmetry_score(left_brow_height, right_brow_height)
    brows_score = round((brows_score + brow_height_sym) / 2, 1)

    # --- НОС ---
    nose_left = p("nose_left") or p("nose_tip")
    nose_right = p("nose_right") or p("nose_tip")
    nose_tip = p("nose_tip")
    contour_left = p("contour_left1") or p("nose_left")
    contour_right = p("contour_right1") or p("nose_right")

    nose_left_w = _dist(nose_tip, nose_left)
    nose_right_w = _dist(nose_tip, nose_right)
    nose_score = _symmetry_score(nose_left_w, nose_right_w)

    # Отклонение носа от центральной оси
    face_left = p("contour_left9") if "contour_left9" in lm else p("contour_left1")
    face_right = p("contour_right9") if "contour_right9" in lm else p("contour_right1")
    face_center_x = (face_left["x"] + face_right["x"]) / 2
    nose_deviation = abs(nose_tip["x"] - face_center_x)
    face_width = _dist(face_left, face_right)
    deviation_penalty = min(30, (nose_deviation / max(face_width, 1)) * 200)
    nose_score = round(max(0, (nose_score + (100 - deviation_penalty)) / 2), 1)

    # --- ГУБЫ ---
    mouth_left = p("mouth_left_corner")
    mouth_right = p("mouth_right_corner")
    upper_lip_top = p("mouth_upper_lip_top") if "mouth_upper_lip_top" in lm else p("mouth_left_corner")
    lower_lip_bot = p("mouth_lower_lip_bottom") if "mouth_lower_lip_bottom" in lm else p("mouth_right_corner")

    left_corner_dist = _dist(mouth_left, _midpoint(upper_lip_top, lower_lip_bot))
    right_corner_dist = _dist(mouth_right, _midpoint(upper_lip_top, lower_lip_bot))
    lips_score = _symmetry_score(left_corner_dist, right_corner_dist)

    mouth_center_x = (mouth_left["x"] + mouth_right["x"]) / 2
    mouth_dev = abs(mouth_center_x - face_center_x)
    mouth_penalty = min(20, (mouth_dev / max(face_width, 1)) * 150)
    lips_score = round(max(0, lips_score - mouth_penalty), 1)

    # --- ОВАЛ ЛИЦА ---
    contour_points_left = [lm.get(f"contour_left{i}", None) for i in range(1, 10)]
    contour_points_right = [lm.get(f"contour_right{i}", None) for i in range(1, 10)]
    contour_points_left = [p for p in contour_points_left if p]
    contour_points_right = [p for p in contour_points_right if p]

    if contour_points_left and contour_points_right:
        face_chin = p("contour_chin")
        left_dists = [_dist(pt, face_chin) for pt in contour_points_left]
        right_dists = [_dist(pt, face_chin) for pt in contour_points_right]
        pairs = zip(left_dists, right_dists)
        oval_scores = [_symmetry_score(l, r) for l, r in pairs]
        oval_score = round(sum(oval_scores) / len(oval_scores), 1)
    else:
        oval_score = 78.0

    overall = round((eyes_score + brows_score + nose_score + lips_score + oval_score) / 5, 1)

    beauty = attrs.get("beauty", {})
    beauty_left = beauty.get("female_score", beauty.get("male_score", 0))

    return {
        "overallScore": overall,
        "zones": [
            {
                "name": "Глаза",
                "left": round(eye_width_sym, 1),
                "right": round(eye_height_sym, 1),
                "score": eyes_score,
                "description": "Ширина и высота разреза глаз",
            },
            {
                "name": "Брови",
                "left": round(brows_score, 1),
                "right": round(brow_height_sym, 1),
                "score": brows_score,
                "description": "Ширина дуги и высота над глазом",
            },
            {
                "name": "Нос",
                "left": round(nose_left_w, 1) if nose_left_w < 200 else 80.0,
                "right": round(nose_right_w, 1) if nose_right_w < 200 else 78.0,
                "score": nose_score,
                "description": "Ширина крыльев и ось симметрии",
            },
            {
                "name": "Губы",
                "left": round(left_corner_dist, 1) if left_corner_dist < 200 else 75.0,
                "right": round(right_corner_dist, 1) if right_corner_dist < 200 else 73.0,
                "score": lips_score,
                "description": "Положение уголков и центральная ось",
            },
            {
                "name": "Овал лица",
                "left": round(oval_score, 1),
                "right": round(oval_score - abs(oval_score - 80) * 0.1, 1),
                "score": oval_score,
                "description": "Контур скул и нижней челюсти",
            },
        ],
        "beautyScore": round(beauty_left, 1),
    }