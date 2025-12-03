// Lightweight client-side search and pagination for data tables
document.addEventListener("DOMContentLoaded", () => {
  const PAGE_SIZE = 20;

  const tables = Array.from(document.querySelectorAll("table[data-table-id]"));
  if (!tables.length) return;

  tables.forEach((table) => {
    const tableId = table.dataset.tableId;
    const tbody = table.querySelector("tbody");
    const headerCells = table.querySelectorAll("thead th");
    if (!tableId || !tbody || !headerCells.length) return;

    const searchInput = document.querySelector(`[data-search-for="${tableId}"]`);
    const paginations = document.querySelectorAll(
      `[data-pagination-for="${tableId}"]`
    );

    const rows = Array.from(tbody.querySelectorAll("tr"));
    let filteredRows = rows.slice();
    let currentPage = 1;

    // Empty-state row reused when no results match
    const emptyRow = document.createElement("tr");
    const emptyCell = document.createElement("td");
    emptyCell.colSpan = headerCells.length;
    emptyCell.className = "text-center text-muted py-3";
    emptyCell.textContent = "No matching records";
    emptyRow.appendChild(emptyCell);
    emptyRow.style.display = "none";
    tbody.appendChild(emptyRow);

    const updateVisibleRows = () => {
      rows.forEach((row) => (row.style.display = "none"));
      emptyRow.style.display = "none";

      const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
      if (currentPage > totalPages) currentPage = totalPages;

      const start = (currentPage - 1) * PAGE_SIZE;
      const visible = filteredRows.slice(start, start + PAGE_SIZE);

      if (!visible.length) {
        emptyRow.style.display = "";
      } else {
        visible.forEach((row) => (row.style.display = ""));
      }

      renderPagination(totalPages);
    };

    const renderPagination = (totalPages) => {
      if (!paginations.length) return;
      paginations.forEach((pagination) => {
        pagination.innerHTML = "";

        const nav = pagination.closest("nav");
        if (totalPages <= 1) {
          if (nav) nav.classList.add("d-none");
          return;
        }
        if (nav) nav.classList.remove("d-none");

        const addEllipsis = () => {
          const li = document.createElement("li");
          li.className = "page-item disabled";
          li.innerHTML = '<span class="page-link">…</span>';
          pagination.appendChild(li);
        };

        const addPageItem = (label, page, disabled = false, active = false) => {
          const li = document.createElement("li");
          li.className = `page-item${disabled ? " disabled" : ""}${
            active ? " active" : ""
          }`;

          const a = document.createElement("a");
          a.className = "page-link";
          a.href = "#";
          a.textContent = label;
          a.addEventListener("click", (evt) => {
            evt.preventDefault();
            if (disabled || page === currentPage) return;
            currentPage = page;
            updateVisibleRows();
          });

          li.appendChild(a);
          pagination.appendChild(li);
        };

        addPageItem("Prev", Math.max(1, currentPage - 1), currentPage === 1);

        const maxVisible = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        let endPage = startPage + maxVisible - 1;

        if (endPage > totalPages) {
          endPage = totalPages;
          startPage = Math.max(1, endPage - maxVisible + 1);
        }

        if (startPage > 1) {
          addPageItem("1", 1, false, currentPage === 1);
          if (startPage > 2) addEllipsis();
        }

        for (let page = startPage; page <= endPage; page++) {
          addPageItem(String(page), page, false, page === currentPage);
        }

        if (endPage < totalPages) {
          if (endPage < totalPages - 1) addEllipsis();
          addPageItem(
            String(totalPages),
            totalPages,
            false,
            currentPage === totalPages
          );
        }

        addPageItem(
          "Next",
          Math.min(totalPages, currentPage + 1),
          currentPage === totalPages
        );
      });
    };

    if (searchInput) {
      searchInput.addEventListener("input", () => {
        const term = searchInput.value.trim().toLowerCase();
        filteredRows = term
          ? rows.filter((row) =>
              row.textContent.toLowerCase().includes(term)
            )
          : rows.slice();
        currentPage = 1;
        updateVisibleRows();
      });
    }

    updateVisibleRows();
  });
});
