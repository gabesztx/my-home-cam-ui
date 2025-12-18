# ImageNet class mapping to our 4 categories: EMBER, ÁLLAT, KOCSI, ISMERETLEN

PERSON_CLASSES = {
    "person", "man", "woman", "boy", "girl", "child", "baby",
    "bride", "groom", "bridegroom", "cowboy", "scuba diver",
    "ballplayer", "baseball player", "basketball player", "football player",
    "tennis player", "golfer", "hockey player", "skier", "snowboarder",
    "surfer", "swimmer", "diver", "parachutist", "skydiver"
}

ANIMAL_CLASSES = {
    "dog", "cat", "bird", "horse", "sheep", "cow", "elephant", "bear",
    "zebra", "giraffe", "tiger", "lion", "leopard", "cheetah", "jaguar",
    "wolf", "fox", "deer", "moose", "elk", "rabbit", "hare", "squirrel",
    "mouse", "rat", "hamster", "guinea pig", "pig", "boar", "goat",
    "chicken", "rooster", "hen", "duck", "goose", "turkey", "peacock",
    "parrot", "eagle", "hawk", "owl", "penguin", "flamingo", "swan",
    "fish", "goldfish", "shark", "whale", "dolphin", "seal", "sea lion",
    "otter", "beaver", "monkey", "ape", "gorilla", "chimpanzee", "orangutan",
    "baboon", "lemur", "koala", "kangaroo", "panda", "raccoon", "skunk",
    "badger", "weasel", "mink", "ferret", "porcupine", "hedgehog",
    "bat", "mole", "shrew", "armadillo", "sloth", "anteater",
    "camel", "llama", "alpaca", "donkey", "mule", "ox", "buffalo",
    "bison", "yak", "reindeer", "caribou", "antelope", "gazelle",
    "impala", "gnu", "wildebeest", "rhinoceros", "hippopotamus",
    "crocodile", "alligator", "lizard", "iguana", "chameleon",
    "snake", "cobra", "viper", "python", "boa", "turtle", "tortoise",
    "frog", "toad", "salamander", "newt", "snail", "slug", "worm",
    "spider", "scorpion", "crab", "lobster", "shrimp", "octopus",
    "squid", "jellyfish", "starfish", "sea urchin", "coral",
    "butterfly", "moth", "bee", "wasp", "hornet", "ant", "termite",
    "beetle", "ladybug", "dragonfly", "damselfly", "grasshopper",
    "cricket", "mantis", "stick insect", "cockroach", "fly", "mosquito",
    # ImageNet specific animal classes
    "tabby", "tabby cat", "tiger cat", "Persian cat", "Siamese cat",
    "Egyptian cat", "cougar", "lynx", "snow leopard", "jaguar",
    "lion", "tiger", "cheetah", "brown bear", "American black bear",
    "ice bear", "polar bear", "sloth bear", "mongoose", "meerkat",
    "tiger beetle", "ladybug", "ground beetle", "long-horned beetle",
    "leaf beetle", "dung beetle", "rhinoceros beetle", "weevil",
    "fly", "bee", "ant", "grasshopper", "cricket", "walking stick",
    "cockroach", "mantis", "cicada", "leafhopper", "lacewing",
    "dragonfly", "damselfly", "admiral", "ringlet", "monarch",
    "cabbage butterfly", "sulphur butterfly", "lycaenid", "starfish",
    "sea urchin", "sea cucumber", "wood rabbit", "hare", "Angora",
    "hamster", "porcupine", "fox squirrel", "marmot", "beaver",
    "guinea pig", "sorrel", "zebra", "hog", "wild boar", "warthog",
    "hippopotamus", "ox", "water buffalo", "bison", "ram", "bighorn",
    "ibex", "hartebeest", "impala", "gazelle", "Arabian camel",
    "llama", "weasel", "mink", "polecat", "black-footed ferret",
    "otter", "skunk", "badger", "armadillo", "three-toed sloth",
    "orangutan", "gorilla", "chimpanzee", "gibbon", "siamang",
    "guenon", "patas", "baboon", "macaque", "langur", "colobus",
    "proboscis monkey", "marmoset", "capuchin", "howler monkey",
    "titi", "spider monkey", "squirrel monkey", "Madagascar cat",
    "indri", "Indian elephant", "African elephant", "lesser panda",
    "giant panda", "barracouta", "eel", "coho", "rock beauty",
    "anemone fish", "sturgeon", "gar", "lionfish", "puffer",
    "abacus", "stingray", "cock", "hen", "ostrich", "brambling",
    "goldfinch", "house finch", "junco", "indigo bunting",
    "robin", "bulbul", "jay", "magpie", "chickadee", "water ouzel",
    "kite", "bald eagle", "vulture", "great grey owl", "European fire salamander",
    "common newt", "eft", "spotted salamander", "axolotl",
    "bullfrog", "tree frog", "tailed frog", "loggerhead",
    "leatherback turtle", "mud turtle", "terrapin", "box turtle",
    "banded gecko", "common iguana", "American chameleon",
    "whiptail", "agama", "frilled lizard", "alligator lizard",
    "Gila monster", "green lizard", "African chameleon",
    "Komodo dragon", "African crocodile", "American alligator",
    "triceratops", "thunder snake", "ringneck snake",
    "hognose snake", "green snake", "king snake", "garter snake",
    "water snake", "vine snake", "night snake", "boa constrictor",
    "rock python", "Indian cobra", "green mamba", "sea snake",
    "horned viper", "diamondback", "sidewinder", "trilobite",
    "harvestman", "scorpion", "black and gold garden spider",
    "barn spider", "garden spider", "black widow", "tarantula",
    "wolf spider", "tick", "centipede", "black grouse",
    "ptarmigan", "ruffed grouse", "prairie chicken", "peacock",
    "quail", "partridge", "African grey", "macaw", "sulphur-crested cockatoo",
    "lorikeet", "coucal", "bee eater", "hornbill", "hummingbird",
    "jacamar", "toucan", "drake", "red-breasted merganser",
    "goose", "black swan", "tusker", "echidna", "platypus",
    "wallaby", "koala", "wombat", "jellyfish", "sea anemone",
    "brain coral", "flatworm", "nematode", "conch", "snail",
    "slug", "sea slug", "chiton", "chambered nautilus", "Dungeness crab",
    "rock crab", "fiddler crab", "king crab", "American lobster",
    "spiny lobster", "crayfish", "hermit crab", "isopod",
    "white stork", "black stork", "spoonbill", "flamingo",
    "little blue heron", "American egret", "bittern", "crane",
    "limpkin", "European gallinule", "American coot", "bustard",
    "ruddy turnstone", "red-backed sandpiper", "redshank",
    "dowitcher", "oystercatcher", "pelican", "king penguin",
    "albatross", "grey whale", "killer whale", "dugong", "sea lion"
}

CAR_CLASSES = {
    "car", "truck", "bus", "van", "minivan", "taxi", "cab",
    "police car", "police van", "ambulance", "fire engine",
    "pickup", "pickup truck", "tow truck", "trailer truck",
    "moving van", "garbage truck", "tractor", "jeep", "limousine",
    "sports car", "race car", "racer", "convertible", "beach wagon",
    "station wagon", "minibus", "trolleybus", "streetcar", "tram",
    "motor scooter", "go-kart", "golf cart", "snowplow", "snowplough"
}


def get_category(class_name: str, confidence: float, threshold: float = 0.55) -> tuple[str, str]:
    """
    Maps ImageNet class name to one of our 4 categories.
    
    Args:
        class_name: ImageNet class name (lowercase)
        confidence: Model confidence score
        threshold: Minimum confidence threshold
        
    Returns:
        tuple: (category, raw_class_name)
        category: "EMBER" | "ÁLLAT" | "KOCSI" | "ISMERETLEN"
    """
    if confidence < threshold:
        return ("ISMERETLEN", class_name)
    
    class_lower = class_name.lower()
    
    # Check for person
    if any(person_class in class_lower for person_class in PERSON_CLASSES):
        return ("EMBER", class_name)
    
    # Check for car/vehicle
    if any(car_class in class_lower for car_class in CAR_CLASSES):
        return ("KOCSI", class_name)
    
    # Check for animal
    if any(animal_class in class_lower for animal_class in ANIMAL_CLASSES):
        return ("ÁLLAT", class_name)
    
    return ("ISMERETLEN", class_name)
