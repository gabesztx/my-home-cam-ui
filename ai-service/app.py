import os
import tempfile
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
import uvicorn
from utils.classifier import ImageClassifier

# Get configuration from environment
AI_CONFIDENCE = float(os.getenv('AI_CONFIDENCE', '0.55'))

# Initialize FastAPI app
app = FastAPI(
    title="HomeCam AI Service",
    description="CPU-friendly video frame classification service",
    version="1.0.0"
)

# Initialize classifier (loaded once at startup)
classifier = None


@app.on_event("startup")
async def startup_event():
    """Initialize the classifier model on startup."""
    global classifier
    print(f"Initializing classifier with confidence threshold: {AI_CONFIDENCE}")
    classifier = ImageClassifier(confidence_threshold=AI_CONFIDENCE)
    print("AI Service ready!")


@app.get("/health")
async def health_check():
    """
    Health check endpoint.
    
    Returns:
        dict: Service status
    """
    return {
        "status": "healthy",
        "service": "HomeCam AI Service",
        "model": "MobileNetV2",
        "confidence_threshold": AI_CONFIDENCE
    }


@app.post("/classify")
async def classify_image(file: UploadFile = File(...)):
    """
    Classify an uploaded image into one of 4 categories:
    EMBER, ÁLLAT, KOCSI, ISMERETLEN
    
    Args:
        file: Uploaded image file (JPEG/PNG)
        
    Returns:
        dict: Classification result with topLabel, confidence, rawTop, rawConfidence
    """
    if classifier is None:
        raise HTTPException(status_code=503, detail="Classifier not initialized")
    
    # Validate file type
    if not file.content_type or not file.content_type.startswith('image/'):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type: {file.content_type}. Expected image/*"
        )
    
    try:
        # Read image bytes
        image_bytes = await file.read()
        
        if len(image_bytes) == 0:
            raise HTTPException(status_code=400, detail="Empty file uploaded")
        
        # Classify the image
        result = classifier.classify_image_bytes(image_bytes)
        
        return JSONResponse(content=result)
    
    except Exception as e:
        print(f"Classification error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Classification failed: {str(e)}"
        )


@app.get("/")
async def root():
    """Root endpoint with service information."""
    return {
        "service": "HomeCam AI Service",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "classify": "POST /classify (multipart/form-data: file=<image>)"
        }
    }


if __name__ == "__main__":
    # Run with: uvicorn app:app --host 127.0.0.1 --port 8001
    uvicorn.run(
        "app:app",
        host="127.0.0.1",
        port=8001,
        reload=False,
        log_level="info"
    )
