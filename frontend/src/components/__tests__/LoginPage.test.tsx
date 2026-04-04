import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import LoginPage from "../LoginPage";

vi.mock("../../auth", () => ({
  useAuth: () => ({ login: vi.fn() }),
}));

describe("LoginPage", () => {
  it("renders the login form", () => {
    render(<LoginPage />);

    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /log in/i })).toBeInTheDocument();
  });
});
