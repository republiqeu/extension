document.addEventListener("DOMContentLoaded", function () {
  const loginForm = document.getElementById("loginForm");
  const loggedInView = document.getElementById("loggedInView");
  const userEmail = document.getElementById("userEmail");
  const logoutButton = document.getElementById("logoutButton");
  const message = document.getElementById("message");
  const loginFormElement = document.getElementById("loginFormElement");

  // Check if user is logged in
  chrome.storage.local.get(["authToken", "userEmail"], function (result) {
    if (result.authToken) {
      showLoggedInView(result.userEmail);
    } else {
      showLoginForm();
    }
  });

  loginFormElement.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {
      const response = await fetch(
        "https://api.republiq.eu/v1/login/access-token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            username: email,
            password: password,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        chrome.storage.local.set(
          { authToken: data.access_token, userEmail: email },
          () => {
            showLoggedInView(email);
            message.textContent = "Login successful!";
          }
        );
      } else {
        const errorData = await response.json();
        message.textContent = `Login failed: ${
          errorData.detail || "Please try again."
        }`;
      }
    } catch (error) {
      console.error("Login error:", error);
      message.textContent = "An error occurred. Please try again.";
    }
  });

  logoutButton.addEventListener("click", function () {
    chrome.storage.local.remove(["authToken", "userEmail"], () => {
      showLoginForm();
      message.textContent = "Logged out successfully";
    });
  });

  function showLoggedInView(email) {
    loginForm.style.display = "none";
    loggedInView.style.display = "block";
    userEmail.textContent = email;
  }

  function showLoginForm() {
    loginForm.style.display = "block";
    loggedInView.style.display = "none";
  }
});
