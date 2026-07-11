import { useEffect, useRef, useState } from 'react';

export default function MenuFilters({ categories, searchQuery, categoryFilter, onSearchChange, onCategoryChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const debounceRef = useRef(null);
  const [localSearch, setLocalSearch] = useState(searchQuery);

  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const selectedLabel = categoryFilter || 'All Categories';

  function handleSearchInput(value) {
    setLocalSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearchChange(value);
    }, 300);
  }

  return (
    <div className="menu-filters-container">
      <div className="menu-filters">
        <input
          type="text"
          id="menuSearch"
          className="menu-search"
          placeholder="Search Dishes"
          value={localSearch}
          onChange={(e) => handleSearchInput(e.target.value)}
        />
        <div className={`custom-dropdown${isOpen ? ' active' : ''}`} id="categoryDropdown" ref={dropdownRef}>
          <button
            type="button"
            className={`custom-dropdown-btn${categoryFilter ? ' has-selection' : ''}`}
            id="categoryDropdownBtn"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen((open) => !open);
            }}
          >
            <span id="categoryDropdownText" className="category-dropdown-text">{selectedLabel}</span>
            <span className="dropdown-arrow">▼</span>
          </button>
          {isOpen ? (
            <div className="custom-dropdown-menu" id="categoryDropdownMenu">
              <button
                type="button"
                className={`dropdown-option${!categoryFilter ? ' selected' : ''}`}
                onClick={() => {
                  onCategoryChange(null);
                  setIsOpen(false);
                }}
              >
                All Categories
              </button>
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={`dropdown-option${categoryFilter === category ? ' selected' : ''}`}
                  onClick={() => {
                    onCategoryChange(category);
                    setIsOpen(false);
                  }}
                >
                  {category}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <select
          id="categoryFilter"
          style={{ display: 'none' }}
          value={categoryFilter || 'all'}
          onChange={(e) => onCategoryChange(e.target.value === 'all' ? null : e.target.value)}
        >
          <option value="all">All Categories</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
