import { useEffect, useMemo, useState } from "react";
import { Card, Input, Table, Tabs, Typography, Button, message } from "antd";

const { Title, Text } = Typography;
const API = import.meta.env.VITE_API_BASE as string;

type InvoiceRow = {
  invoiceId: number;
  orderId: number;
  facturapiInvoiceId: string;
  createdAt: string;
  emailedAt: string | null;
  uploadedAt: string | null;
  mediaPdfUrl: string | null;
  mediaXmlUrl: string | null;
  mediaZipUrl: string | null;
  folio: string;
  numcheque: string;
  fecha: string;
  total: string;
  customerId: number | null;
  taxId: string | null;
  legalName: string | null;
  email: string | null;
};

type CustomerRow = {
  id: number;
  taxId: string;
  legalName: string;
  taxSystem: string;
  email: string;
  zip: string | null;
  facturapiCustomerId: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function Admin() {
  const [token, setToken] = useState(localStorage.getItem("adminToken") || "");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);

  async function fetchInvoices() {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ q, limit: "100", offset: "0" });
      const r = await fetch(`${API}/api/admin/invoices?${qs}`, {
        headers: { "x-admin-token": token },
      });
      const data = await r.json();
      if (!r.ok) return message.error(data?.error || "Error cargando facturas");
      setInvoices(data.rows || []);
    } finally {
      setLoading(false);
    }
  }

  async function fetchCustomers() {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ q, limit: "100", offset: "0" });
      const r = await fetch(`${API}/api/admin/customers?${qs}`, {
        headers: { "x-admin-token": token },
      });
      const data = await r.json();
      if (!r.ok) return message.error(data?.error || "Error cargando clientes");
      setCustomers(data.rows || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // carga inicial solo si hay token
    if (token) fetchInvoices();
  }, []);

  const invoiceColumns = useMemo(
    () => [
      { title: "InvoiceID", dataIndex: "invoiceId", width: 90 },
      { title: "Numcheque", dataIndex: "numcheque", width: 120 },
      { title: "Folio", dataIndex: "folio", width: 120 },
      { title: "Fecha", dataIndex: "fecha", width: 220 },
      { title: "Total", dataIndex: "total", width: 100 },
      { title: "Cliente", dataIndex: "legalName", width: 220 },
      { title: "Email", dataIndex: "email", width: 220 },
      {
        title: "Archivos",
        render: (_: any, row: InvoiceRow) => {
          const pdf =
            row.mediaPdfUrl || `${API}/api/invoices/${row.invoiceId}/pdf`;
          const xml =
            row.mediaXmlUrl || `${API}/api/invoices/${row.invoiceId}/xml`;
          const zip =
            row.mediaZipUrl || `${API}/api/invoices/${row.invoiceId}/zip`;
          return (
            <div className="flex gap-2">
              <a href={pdf} target="_blank">
                PDF
              </a>
              <a href={xml} target="_blank">
                XML
              </a>
              <a href={zip} target="_blank">
                ZIP
              </a>
            </div>
          );
        },
        width: 160,
      },
    ],
    [token]
  );

  const customerColumns = useMemo(
    () => [
      { title: "ID", dataIndex: "id", width: 80 },
      { title: "RFC", dataIndex: "taxId", width: 170 },
      { title: "Nombre/Razón", dataIndex: "legalName", width: 260 },
      { title: "Régimen", dataIndex: "taxSystem", width: 90 },
      { title: "Email", dataIndex: "email", width: 240 },
    ],
    []
  );

  function saveToken() {
    localStorage.setItem("adminToken", token);
    message.success("Token guardado");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <Title level={3}>Admin — Facturación Cantina La Llorona</Title>

        <Card className="shadow-sm mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Text type="secondary">Admin token</Text>
              <Input.Password
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
              <Button className="mt-2" onClick={saveToken}>
                Guardar token
              </Button>
            </div>
            <div className="md:col-span-2">
              <Text type="secondary">Filtro (numcheque / RFC / nombre)</Text>
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Ej: 12388"
              />
              <div className="mt-2 flex gap-2">
                <Button type="primary" onClick={fetchInvoices}>
                  Buscar facturas
                </Button>
                <Button onClick={fetchCustomers}>Buscar clientes</Button>
              </div>
            </div>
          </div>
        </Card>

        <Tabs
          items={[
            {
              key: "invoices",
              label: "Facturas",
              children: (
                <Table
                  rowKey="invoiceId"
                  loading={loading}
                  dataSource={invoices}
                  columns={invoiceColumns as any}
                  scroll={{ x: 1200 }}
                  pagination={{ pageSize: 50 }}
                />
              ),
            },
            {
              key: "customers",
              label: "Clientes",
              children: (
                <Table
                  rowKey="id"
                  loading={loading}
                  dataSource={customers}
                  columns={customerColumns as any}
                  scroll={{ x: 900 }}
                  pagination={{ pageSize: 50 }}
                />
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
