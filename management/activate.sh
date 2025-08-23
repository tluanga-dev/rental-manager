#!/bin/bash
# Convenience script to activate the management tools virtual environment
# Usage: source activate.sh

# Check if we're in the management directory
if [ ! -f "pyproject.toml" ]; then
    echo "❌ Error: Please run this script from the management directory"
    return 1 2>/dev/null || exit 1
fi

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "❌ Error: Virtual environment not found. Run 'python3 -m venv venv' first"
    return 1 2>/dev/null || exit 1
fi

# Activate virtual environment
source venv/bin/activate

# Set project-specific environment variables if needed
export PYTHONPATH="${PWD}:${PYTHONPATH}"

echo "✅ Management tools virtual environment activated"
echo "📁 Working directory: $(pwd)"
echo "🐍 Python version: $(python --version)"
echo "📦 Python location: $(which python)"

# Show available commands
echo ""
echo "💡 Available commands:"
echo "  python test_install.py     - Test the installation"
echo "  python main.py             - Run management console (when fixed)"
echo "  pip list                   - Show installed packages"
echo "  deactivate                 - Exit virtual environment"