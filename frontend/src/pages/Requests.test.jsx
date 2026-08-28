import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Requests from "./Requests.jsx";
import client from "../api/client.js";

vi.mock("../api/client.js", () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

vi.mock("../context/AuthContext.jsx", () => ({
  useAuth: () => ({ isAdmin: true }),
}));

const requests = [
  {
    id: 1,
    employee_name: "Nimali Perera",
    item_name: "A4 Paper",
    quantity: 2,
    status: "pending",
    request_date: "2026-08-28T08:00:00Z",
    response_date: null,
    admin_note: null,
  },
  {
    id: 2,
    employee_name: "Kamal Silva",
    item_name: "Toner",
    quantity: 1,
    status: "approved",
    request_date: "2026-08-27T08:00:00Z",
    response_date: "2026-08-27T10:00:00Z",
    admin_note: "Approved",
  },
];

describe("admin request review queue", () => {
  beforeEach(() => {
    client.get.mockImplementation((url) =>
      Promise.resolve({ data: url === "/requests" ? requests : [] })
    );
  });

  it("opens on pending requests and shows decision actions", async () => {
    render(<MemoryRouter><Requests /></MemoryRouter>);

    expect(await screen.findByText("A4 Paper")).toBeInTheDocument();
    expect(screen.queryByText("Toner")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pending (1)" })).toHaveClass("bg-brand-600");
  });

  it("filters approved requests and exposes only the fulfill action", async () => {
    render(<MemoryRouter><Requests /></MemoryRouter>);
    await screen.findByText("A4 Paper");

    fireEvent.click(screen.getByRole("button", { name: "Approved (1)" }));

    await waitFor(() => expect(screen.getByText("Toner")).toBeInTheDocument());
    expect(screen.queryByText("A4 Paper")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fulfill" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
  });
});
