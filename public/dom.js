// Easter egg: detect "teapot" typing
(function () {
  let typedKeys = [];
  const secretCode = "dom";

  document.addEventListener("keydown", function (e) {
    // Add the pressed key to the array
    typedKeys.push(e.key.toLowerCase());

    // Keep only the last 3 characters
    if (typedKeys.length > secretCode.length) {
      typedKeys.shift();
    }

    // Check if the typed sequence matches "teapot"
    if (typedKeys.join("") === secretCode) {
      // Redirect to the dom page
      window.location.href = "/dom";
    }
  });
})();
