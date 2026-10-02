import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LocaleProvider } from "../src/i18n/locale-context";
import { LoginPage, RoleHomePage } from "../src/features/auth";

/**
 * Unit 02 frontend: the role picker reveals the chosen role's credentials, a
 * rejected login shows the one generic message, and a successful login lands on the
 * role's placeholder home. `fetch` is mocked; no server is contacted.
 */
function renderLogin() {
  return render(
    <LocaleProvider initialLocale="en">
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/player" element={<RoleHomePage role="PLAYER" />} />
        </Routes>
      </MemoryRouter>
    </LocaleProvider>,
  );
}

function choosePlayerAndSubmit() {
  fireEvent.click(screen.getByRole("button", { name: "Player" }));
  fireEvent.change(screen.getByLabelText("Username"), {
    target: { value: "player-1" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "secret" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Log in" }));
}

afterEach(() => {
  window.localStorage.clear();
  jest.restoreAllMocks();
});

describe("login page", () => {
  it("shows the role picker and hides credentials until a role is chosen", () => {
    renderLogin();
    expect(screen.getByRole("button", { name: "Player" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Judge" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Controller" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Username")).not.toBeInTheDocument();
  });

  it("reveals the username and password fields after choosing a role", () => {
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: "Judge" }));
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("shows one generic message on a rejected login", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 });
    renderLogin();
    choosePlayerAndSubmit();
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Incorrect username or password",
      );
    });
  });

  it("lands on the role home after a successful login", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        token: "tok",
        deviceId: "dev",
        role: "PLAYER",
        accountId: "acc-1",
        sessionExpiresAt: new Date().toISOString(),
      }),
    });
    renderLogin();
    choosePlayerAndSubmit();
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Player home" }),
      ).toBeInTheDocument();
    });
  });
});
