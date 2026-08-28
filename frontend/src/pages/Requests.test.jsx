import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Requests from "./Requests.jsx";
import client from "../api/client.js";

const authState = vi.hoisted(() => ({ isAdmin: true }));

vi.mock("../api/client.js", () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

vi.mock("../context/AuthContext.jsx", () => ({
  useAuth: () => ({ isAdmin: authState.isAdmin }),
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
    authState.isAdmin = true;
    client.post.mockReset();
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

  it("shows success feedback after approving a request", async () => {
    client.post.mockResolvedValue({ data: { ...requests[0], status: "approved" } });
    render(<MemoryRouter><Requests /></MemoryRouter>);
    await screen.findByText("A4 Paper");

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Request approved successfully.");
    expect(client.post).toHaveBeenCalledWith("/requests/1/approve", { admin_note: null });
  });

  it("shows in-app error feedback when an action fails", async () => {
    client.post.mockRejectedValue({ response: { data: { detail: "Request was already updated" } } });
    render(<MemoryRouter><Requests /></MemoryRouter>);
    await screen.findByText("A4 Paper");

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    const alerts = await screen.findAllByRole("alert");
    expect(alerts.some((alert) => alert.textContent.includes("Request was already updated"))).toBe(true);
  });
});

describe("employee request feedback", () => {
  beforeEach(() => {
    authState.isAdmin = false;
    client.post.mockReset();
    client.get.mockImplementation((url) =>
      Promise.resolve({
        data: url === "/requests"
          ? []
          : [{ id: 10, name: "A4 Paper", quantity_in_stock: 5 }],
      })
    );
  });

  it("confirms a successful item request without a browser alert", async () => {
    client.post.mockResolvedValue({ data: { id: 3, status: "pending" } });
    render(<MemoryRouter><Requests /></MemoryRouter>);
    await screen.findByText("You haven't made any requests yet.");

    fireEvent.click(screen.getAllByRole("button", { name: "+ New Request" })[0]);
    fireEvent.change(screen.getByLabelText("Item"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit Request" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Item request submitted successfully.");
    expect(client.post).toHaveBeenCalledWith("/requests", { item_id: 10, quantity: 2 });
  });
});
