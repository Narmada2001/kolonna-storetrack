import { Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Inventory from "./pages/Inventory.jsx";
import Requests from "./pages/Requests.jsx";
import Suppliers from "./pages/Suppliers.jsx";
import Transactions from "./pages/Transactions.jsx";
import Reports from "./pages/Reports.jsx";
import Backups from "./pages/Backups.jsx";
import Users from "./pages/Users.jsx";

function Protected({ children, adminOnly }) {
  return (
    <ProtectedRoute adminOnly={adminOnly}>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/inventory" element={<Protected><Inventory /></Protected>} />
      <Route path="/requests" element={<Protected><Requests /></Protected>} />
      <Route path="/suppliers" element={<Protected adminOnly><Suppliers /></Protected>} />
      <Route path="/transactions" element={<Protected adminOnly><Transactions /></Protected>} />
      <Route path="/reports" element={<Protected adminOnly><Reports /></Protected>} />
      <Route path="/backups" element={<Protected adminOnly><Backups /></Protected>} />
      <Route path="/users" element={<Protected adminOnly><Users /></Protected>} />
    </Routes>
  );
}
