// Easter egg: detect "teapot" typing
(function () {
  let typedKeys = [];
  const secretCode = "tableau";

  document.addEventListener("keydown", function (e) {
    // Add the pressed key to the array
    typedKeys.push(e.key.toLowerCase());

    // Keep only the last 6 characters
    if (typedKeys.length > secretCode.length) {
      typedKeys.shift();
    }

    // Check if the typed sequence matches "teapot"
    if (typedKeys.join("") === secretCode) {
      // Redirect to the tableau page
      window.location.href = "/tableau";
    }
  });
})();
