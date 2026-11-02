import sys
from pathlib import Path

# Make `import server` work when pytest runs from backend/ or the repo root
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
