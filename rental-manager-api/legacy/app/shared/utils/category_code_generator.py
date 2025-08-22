"""
Category Code Generator Service

Generates unique category codes following the pattern:
- Level 1: CON (3-4 chars from category name)
- Level 2: CON-EXC (parent + 3-4 chars)
- Level 3: CON-EXC-MIN (parent + 2-3 chars)

Max length: 10 characters
"""

import re
from typing import Optional, List
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.master_data.categories.models import Category


class CategoryCodeGenerator:
    """Service for generating unique category codes."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    def _clean_name(self, name: str) -> str:
        """Clean category name for code generation."""
        # Remove common words and connectors
        stop_words = {'and', 'or', 'the', 'a', 'an', 'of', 'for', 'with', 'in', 'on', 'at', 'by', 'to'}
        
        # Split on common separators and filter
        words = re.findall(r'\b[a-zA-Z]+\b', name.upper())
        filtered_words = [word for word in words if word.lower() not in stop_words and len(word) > 1]
        
        return ' '.join(filtered_words) if filtered_words else name.upper()
    
    def _generate_abbreviation(self, text: str, max_length: int, prefer_consonants: bool = True) -> str:
        """Generate abbreviation from text."""
        text = self._clean_name(text)
        words = text.split()
        
        if len(words) == 1:
            # Single word - take first letters, then consonants if needed
            word = words[0]
            if len(word) <= max_length:
                return word
            
            # Try consonants first if prefer_consonants is True
            if prefer_consonants:
                consonants = ''.join([c for c in word if c not in 'AEIOU'])
                if len(consonants) >= max_length:
                    return consonants[:max_length]
            
            # Take first max_length characters
            return word[:max_length]
        
        else:
            # Multiple words - take first letters of each word
            abbreviation = ''.join([word[0] for word in words])
            
            if len(abbreviation) <= max_length:
                return abbreviation
            
            # If too long, take first letters of most important words
            # Keep first word and last word, then others by length
            if len(words) >= 2:
                important_words = [words[0], words[-1]]
                if len(words) > 2:
                    # Add middle words sorted by length (longest first)
                    middle_words = sorted(words[1:-1], key=len, reverse=True)
                    important_words = [words[0]] + middle_words + [words[-1]]
                
                abbreviation = ''.join([word[0] for word in important_words])
                return abbreviation[:max_length]
            
            return abbreviation[:max_length]
    
    async def _is_code_unique(self, code: str, exclude_id: Optional[str] = None) -> bool:
        """Check if category code is unique in database."""
        query = select(func.count()).select_from(Category).where(
            Category.category_code == code.upper()
        )
        
        if exclude_id:
            query = query.where(Category.id != exclude_id)
        
        result = await self.session.execute(query)
        count = result.scalar_one()
        return count == 0
    
    async def _get_parent_code(self, parent_category_id: Optional[str]) -> Optional[str]:
        """Get parent category code."""
        if not parent_category_id:
            return None
        
        query = select(Category.category_code).where(Category.id == parent_category_id)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
    
    async def generate_category_code(
        self, 
        category_name: str, 
        parent_category_id: Optional[str] = None,
        category_level: int = 1,
        exclude_id: Optional[str] = None
    ) -> str:
        """
        Generate unique category code.
        
        Args:
            category_name: Name of the category
            parent_category_id: ID of parent category (if any)
            category_level: Level in hierarchy (1=root, 2=sub, etc.)
            exclude_id: Category ID to exclude from uniqueness check (for updates)
            
        Returns:
            Unique category code string
            
        Examples:
            - "Construction Equipment" (Level 1) -> "CON"
            - "Excavators" with parent "CON" (Level 2) -> "CON-EXC"  
            - "Mini Excavators" with parent "CON-EXC" (Level 3) -> "CON-EXC-MIN"
        """
        parent_code = await self._get_parent_code(parent_category_id) if parent_category_id else None
        
        # Calculate available length for this level's abbreviation
        if category_level == 1:
            # Root level: use up to 4 characters
            max_abbrev_length = 4
            base_code = ""
        elif category_level == 2:
            # Second level: parent + dash + 3-4 chars
            if not parent_code:
                raise ValueError("Level 2 categories must have a parent")
            base_code = f"{parent_code}-"
            remaining_length = 10 - len(base_code)
            max_abbrev_length = min(4, remaining_length)
        elif category_level == 3:
            # Third level: parent + dash + 2-3 chars  
            if not parent_code:
                raise ValueError("Level 3 categories must have a parent")
            base_code = f"{parent_code}-"
            remaining_length = 10 - len(base_code)
            max_abbrev_length = max(2, min(3, remaining_length))  # Ensure at least 2 chars
        else:
            # Level 4+: parent + dash + 2 chars max
            if not parent_code:
                raise ValueError(f"Level {category_level} categories must have a parent")
            base_code = f"{parent_code}-"
            remaining_length = 10 - len(base_code)
            max_abbrev_length = min(2, remaining_length)
        
        if max_abbrev_length < 2:
            raise ValueError(f"Cannot generate code for '{category_name}' - parent code too long")
        
        # Generate abbreviation for this level
        abbreviation = self._generate_abbreviation(category_name, max_abbrev_length)
        proposed_code = f"{base_code}{abbreviation}".upper()
        
        # Ensure uniqueness
        original_code = proposed_code
        counter = 1
        
        while not await self._is_code_unique(proposed_code, exclude_id):
            # Try variations
            if counter == 1:
                # Try with consonants only if we haven't already
                consonant_abbrev = self._generate_abbreviation(
                    category_name, max_abbrev_length, prefer_consonants=True
                )
                if consonant_abbrev != abbreviation:
                    proposed_code = f"{base_code}{consonant_abbrev}".upper()
                    if await self._is_code_unique(proposed_code, exclude_id):
                        break
            
            # Try with numbers
            if max_abbrev_length >= 2:
                # Replace last character with number
                abbrev_with_num = abbreviation[:-1] + str(counter)
                proposed_code = f"{base_code}{abbrev_with_num}".upper()
            else:
                # Very short abbreviation, append number if space allows
                total_with_num = len(base_code) + len(abbreviation) + len(str(counter))
                if total_with_num <= 10:
                    proposed_code = f"{base_code}{abbreviation}{counter}".upper()
                else:
                    # Replace last char with number
                    proposed_code = f"{base_code}{abbreviation[:-1]}{counter}".upper()
            
            counter += 1
            if counter > 99:  # Safety valve
                raise ValueError(f"Could not generate unique code for '{category_name}'")
        
        if len(proposed_code) > 10:
            raise ValueError(f"Generated code '{proposed_code}' exceeds 10 character limit")
        
        return proposed_code
    
    async def validate_category_code(
        self, 
        code: str, 
        exclude_id: Optional[str] = None
    ) -> tuple[bool, Optional[str]]:
        """
        Validate category code format and uniqueness.
        
        Args:
            code: Category code to validate
            exclude_id: Category ID to exclude from uniqueness check
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        if not code or not code.strip():
            return False, "Category code cannot be empty"
        
        code = code.strip().upper()
        
        if len(code) > 10:
            return False, "Category code cannot exceed 10 characters"
        
        if not re.match(r'^[A-Z0-9\-]+$', code):
            return False, "Category code must contain only uppercase letters, numbers, and dashes"
        
        if code.startswith('-') or code.endswith('-'):
            return False, "Category code cannot start or end with a dash"
        
        if '--' in code:
            return False, "Category code cannot contain consecutive dashes"
        
        # Check uniqueness
        if not await self._is_code_unique(code, exclude_id):
            return False, f"Category code '{code}' already exists"
        
        return True, None


# Example usage and test functions
async def test_generator():
    """Test the category code generator."""
    # This would be used in unit tests
    pass


# Utility functions for common category name patterns
def suggest_category_codes(category_names: List[str]) -> List[str]:
    """
    Suggest category codes for a list of category names.
    This is a helper function that doesn't require database access.
    """
    generator = CategoryCodeGenerator(None)  # No session for offline suggestions
    
    suggestions = []
    for name in category_names:
        try:
            # Generate offline suggestion (without uniqueness check)
            if ' ' in name:
                words = name.split()
                suggestion = ''.join([word[0] for word in words])[:4].upper()
            else:
                suggestion = generator._generate_abbreviation(name, 4)
            
            suggestions.append(suggestion)
        except Exception:
            suggestions.append(name[:4].upper())
    
    return suggestions