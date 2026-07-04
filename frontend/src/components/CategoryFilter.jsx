function CategoryFilter({ categories, selectedCategory, onSelectCategory }) {
  const categoryOptions = ["Tümü", ...categories];

  return (
    <nav className="category-filter" aria-label="Kategori filtresi">
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
    </nav>
  );
}

export default CategoryFilter;
