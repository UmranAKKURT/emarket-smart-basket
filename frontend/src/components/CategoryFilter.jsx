import { ALL_CATEGORIES } from "../config/constants.js";

function CategoryFilter({ categories, selectedCategory, onSelectCategory }) {
  const categoryOptions = [ALL_CATEGORIES, ...categories];

  return (
    <nav className="category-filter" aria-label="Kategori filtresi">
      <div className="category-filter-scroll">
        {categoryOptions.map((category) => {
          const isSelected = selectedCategory === category;

          return (
            <button
              className={isSelected ? "category-chip active" : "category-chip"}
              key={category}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelectCategory(category)}
            >
              {category}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default CategoryFilter;
