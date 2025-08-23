#!/bin/bash
# Setup script for management tools
# Creates virtual environment and installs dependencies

set -e  # Exit on error

echo "🏠 Setting up Rental Manager Management Tools"
echo "============================================="

# Check Python version
python3_version=$(python3 --version 2>&1 | grep -oE '[0-9]+\.[0-9]+')
echo "🐍 Python version: $python3_version"

# Check if Python version is >= 3.11
if ! python3 -c "import sys; exit(0 if sys.version_info >= (3, 11) else 1)"; then
    echo "❌ Error: Python 3.11 or higher required"
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
else
    echo "📦 Virtual environment already exists"
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Upgrade pip and tools
echo "⬆️ Upgrading pip and build tools..."
pip install --upgrade pip setuptools wheel

# Install package in editable mode
echo "📚 Installing management tools and dependencies..."
pip install -e .

# Run installation test
echo "🧪 Testing installation..."
if python test_install.py; then
    echo ""
    echo "✅ Setup completed successfully!"
    echo ""
    echo "💡 To use the management tools:"
    echo "  source activate.sh    # Activate environment"
    echo "  python test_install.py   # Test installation" 
    echo "  python main.py           # Run management console (when syntax is fixed)"
    echo ""
    echo "🔧 Development commands:"
    echo "  pip install -e '.[dev]'  # Install dev dependencies"
    echo "  pytest                   # Run tests (when available)"
    echo "  ruff check .             # Code linting"
    echo "  mypy .                   # Type checking"
else
    echo ""
    echo "❌ Setup completed but tests failed"
    echo "Check the errors above and fix any issues"
    exit 1
fi