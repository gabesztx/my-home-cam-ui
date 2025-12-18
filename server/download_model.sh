#!/bin/bash

# A modell mentési helye (a szerver assets/models mappája)
MODEL_DIR="server/assets/models"
MODEL_PATH="$MODEL_DIR/yolo.onnx"

# Ellenőrizzük, hogy létezik-e a mappa
mkdir -p "$MODEL_DIR"

if [ -f "$MODEL_PATH" ]; then
    echo "A modell már létezik: $MODEL_PATH"
    exit 0
fi

echo "YOLOv8n modell letöltése (kb. 12 MB)..."
# Egy publikus YOLOv8n ONNX modell letöltése (példaként az Ultralytics tárolójából vagy hasonló forrásból)
# Itt egy megbízható direkt linket használunk
curl -L -o "$MODEL_PATH" "https://github.com/ultralytics/assets/releases/download/v8.2.0/yolov8n.onnx"

if [ $? -eq 0 ]; then
    echo "Sikeres letöltés! A modell helye: $MODEL_PATH"
else
    echo "Hiba történt a letöltés során."
    exit 1
fi
