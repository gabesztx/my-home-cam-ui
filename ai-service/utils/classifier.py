import torch
import torchvision.transforms as transforms
from torchvision.models import mobilenet_v2, MobileNet_V2_Weights
from PIL import Image
import json
from typing import Tuple
from .labels_map import get_category


class ImageClassifier:
    """
    CPU-friendly image classifier using MobileNetV2 with ImageNet weights.
    Optimized for fast inference on weak CPUs (Intel G3240).
    """
    
    def __init__(self, confidence_threshold: float = 0.55):
        """
        Initialize the classifier with MobileNetV2 model.
        
        Args:
            confidence_threshold: Minimum confidence for classification
        """
        self.confidence_threshold = confidence_threshold
        self.device = torch.device('cpu')
        
        # Load MobileNetV2 with pretrained ImageNet weights
        print("Loading MobileNetV2 model...")
        weights = MobileNet_V2_Weights.IMAGENET1K_V1
        self.model = mobilenet_v2(weights=weights)
        self.model.to(self.device)
        self.model.eval()  # Set to evaluation mode
        
        # Get ImageNet class labels
        self.class_labels = weights.meta["categories"]
        
        # Define preprocessing transforms (224x224 as required by MobileNetV2)
        self.preprocess = transforms.Compose([
            transforms.Resize(256),
            transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            )
        ])
        
        print(f"Model loaded successfully. Device: {self.device}")
    
    def classify_image(self, image_path: str) -> dict:
        """
        Classify an image and return the category.
        
        Args:
            image_path: Path to the image file
            
        Returns:
            dict: Classification result with topLabel, confidence, rawTop, rawConfidence
        """
        # Load and preprocess image
        image = Image.open(image_path).convert('RGB')
        input_tensor = self.preprocess(image)
        input_batch = input_tensor.unsqueeze(0).to(self.device)
        
        # Perform inference
        with torch.no_grad():
            output = self.model(input_batch)
        
        # Get probabilities
        probabilities = torch.nn.functional.softmax(output[0], dim=0)
        
        # Get top prediction
        top_prob, top_idx = torch.topk(probabilities, 1)
        top_confidence = top_prob.item()
        top_class = self.class_labels[top_idx.item()]
        
        # Map to our categories
        category, raw_class = get_category(
            top_class,
            top_confidence,
            self.confidence_threshold
        )
        
        return {
            "topLabel": category,
            "confidence": round(top_confidence, 4),
            "rawTop": top_class,
            "rawConfidence": round(top_confidence, 4)
        }
    
    def classify_image_bytes(self, image_bytes: bytes) -> dict:
        """
        Classify an image from bytes.
        
        Args:
            image_bytes: Image data as bytes
            
        Returns:
            dict: Classification result
        """
        from io import BytesIO
        
        # Load and preprocess image
        image = Image.open(BytesIO(image_bytes)).convert('RGB')
        input_tensor = self.preprocess(image)
        input_batch = input_tensor.unsqueeze(0).to(self.device)
        
        # Perform inference
        with torch.no_grad():
            output = self.model(input_batch)
        
        # Get probabilities
        probabilities = torch.nn.functional.softmax(output[0], dim=0)
        
        # Get top prediction
        top_prob, top_idx = torch.topk(probabilities, 1)
        top_confidence = top_prob.item()
        top_class = self.class_labels[top_idx.item()]
        
        # Map to our categories
        category, raw_class = get_category(
            top_class,
            top_confidence,
            self.confidence_threshold
        )
        
        return {
            "topLabel": category,
            "confidence": round(top_confidence, 4),
            "rawTop": top_class,
            "rawConfidence": round(top_confidence, 4)
        }
