import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  DatePicker,
  Input,
  Table,
  Tabs,
  Typography,
  message,
} from "antd";
import { Modal, Select, Form } from "antd";

import type { ColumnsType } from "antd/es/table";
import dayjs, { Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault("America/Mexico_City");

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
  fecha: string; // UTC ISO
  total: string;
  customerId: number | null;
  taxId: string | null;
  legalName: string | null;
  email: string | null;
  facturapiStatus?: string | null;
  cancellationStatus?: string | null;
  uuid?: string | null;
  cancellationMotive?: string | null;
  cancellationRequestedAt?: string | null;
  canceledAt?: string | null;
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

function fmtMx(iso: string) {
  return dayjs(iso).tz("America/Mexico_City").format("YYYY-MM-DD HH:mm");
}

export default function Admin() {
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelRow, setCancelRow] = useState<InvoiceRow | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelForm] = Form.useForm();

  const [token, setToken] = useState(localStorage.getItem("adminToken") || "");
  const [activeTab, setActiveTab] = useState<"invoices" | "customers">(
    "invoices"
  );
  const [loading, setLoading] = useState(false);

  // ===== invoices filters =====
  const [numcheque, setNumcheque] = useState("");
  const [folio, setFolio] = useState("");
  const [customerQ, setCustomerQ] = useState(""); // RFC/razón/email
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null]>([
    null,
    null,
  ]);

  // ===== customers filters =====
  const [customerSearch, setCustomerSearch] = useState("");

  // data
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);

  // pagination
  const [invPage, setInvPage] = useState({ current: 1, pageSize: 50 });
  const [custPage, setCustPage] = useState({ current: 1, pageSize: 50 });

  function saveToken() {
    localStorage.setItem("adminToken", token);
    message.success("Token guardado");
  }

  async function cancelInvoice() {
    if (!cancelRow) return;
    const values = await cancelForm.validateFields();
    setCancelLoading(true);
    try {
      const r = await fetch(
        `${API}/api/admin/invoices/${cancelRow.invoiceId}/cancel`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-token": token,
          },
          body: JSON.stringify({
            motive: values.motive,
            substitution: values.substitution || undefined,
          }),
        }
      );
      const data = await r.json();
      if (!r.ok) return message.error(data?.error || "No se pudo cancelar");
      message.success("Solicitud de cancelación enviada");
      setCancelOpen(false);
      setCancelRow(null);
      await fetchInvoices({ current: 1, pageSize: invPage.pageSize });
    } finally {
      setCancelLoading(false);
    }
  }

  async function fetchInvoices(p = invPage) {
    if (!token) return message.warning("Guarda el admin token primero.");
    setLoading(true);
    try {
      const offset = (p.current - 1) * p.pageSize;

      const qs = new URLSearchParams({
        numcheque: numcheque.trim(),
        folio: folio.trim(),
        customerQ: customerQ.trim(),
        limit: String(p.pageSize),
        offset: String(offset),
      });

      // rango fechas (local MX) -> YYYY-MM-DD
      if (range[0]) qs.set("dateFrom", range[0].format("YYYY-MM-DD"));
      if (range[1]) qs.set("dateTo", range[1].format("YYYY-MM-DD"));

      const r = await fetch(`${API}/api/admin/invoices?${qs.toString()}`, {
        headers: { "x-admin-token": token },
      });
      const data = await r.json();
      if (!r.ok) return message.error(data?.error || "Error cargando facturas");

      setInvoices(data.rows || []);
      setInvPage(p);
    } finally {
      setLoading(false);
    }
  }

  async function fetchCustomers(p = custPage) {
    if (!token) return message.warning("Guarda el admin token primero.");
    setLoading(true);
    try {
      const offset = (p.current - 1) * p.pageSize;

      const qs = new URLSearchParams({
        q: customerSearch.trim(),
        limit: String(p.pageSize),
        offset: String(offset),
      });

      const r = await fetch(`${API}/api/admin/customers?${qs.toString()}`, {
        headers: { "x-admin-token": token },
      });
      const data = await r.json();
      if (!r.ok) return message.error(data?.error || "Error cargando clientes");

      setCustomers(data.rows || []);
      setCustPage(p);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // carga inicial si ya hay token guardado
    if (token) fetchInvoices({ current: 1, pageSize: invPage.pageSize });
    if (token)
      fetchCustomers({
        current: 1,
        pageSize: custPage.pageSize,
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const invoiceColumns: ColumnsType<InvoiceRow> = useMemo(
    () => [
      { title: "InvoiceID", dataIndex: "invoiceId", width: 90, fixed: "left" },
      { title: "Numcheque", dataIndex: "numcheque", width: 120 },
      { title: "Folio", dataIndex: "folio", width: 120 },
      {
        title: "Fecha (MX)",
        dataIndex: "fecha",
        width: 150,
        render: (v) => <span>{fmtMx(v)}</span>,
      },
      { title: "Total", dataIndex: "total", width: 110 },
      { title: "RFC", dataIndex: "taxId", width: 170 },
      { title: "Cliente", dataIndex: "legalName", width: 220 },
      { title: "Email", dataIndex: "email", width: 220 },
      {
        title: "SAT",
        width: 160,
        render: (_: any, row: InvoiceRow) => (
          <div className="flex flex-col gap-1">
            <span className="text-xs">
              status: <b>{row.facturapiStatus || "-"}</b>
            </span>
            <span className="text-xs">
              cancel: <b>{row.cancellationStatus || "none"}</b>
            </span>
          </div>
        ),
      },

      {
        title: "Estado",
        width: 140,
        render: (_: any, row: InvoiceRow) => (
          <div className="flex flex-col gap-1">
            <Badge
              status={row.emailedAt ? "success" : "warning"}
              text={row.emailedAt ? "Email OK" : "Sin email"}
            />
            <Badge
              status={row.uploadedAt ? "success" : "default"}
              text={row.uploadedAt ? "FTP OK" : "Sin FTP"}
            />
          </div>
        ),
      },
      {
        title: "Archivos",
        width: 180,
        render: (_: any, row: InvoiceRow) => {
          const pdf =
            row.mediaPdfUrl || `${API}/api/invoices/${row.invoiceId}/pdf`;
          const xml =
            row.mediaXmlUrl || `${API}/api/invoices/${row.invoiceId}/xml`;
          const zip =
            row.mediaZipUrl || `${API}/api/invoices/${row.invoiceId}/zip`;
          return (
            <div className="flex gap-3">
              <a href={pdf} target="_blank" rel="noreferrer">
                PDF
              </a>
              <a href={xml} target="_blank" rel="noreferrer">
                XML
              </a>
              <a href={zip} target="_blank" rel="noreferrer">
                ZIP
              </a>
            </div>
          );
        },
      },
      {
        title: "Acciones",
        width: 180,
        render: (_: any, row: InvoiceRow) => {
          const disabled =
            row.facturapiStatus === "canceled" ||
            row.cancellationStatus === "pending";

          return (
            <div className="flex gap-2">
              <Button
                size="small"
                onClick={async () => {
                  const r = await fetch(
                    `${API}/api/admin/invoices/${row.invoiceId}/refresh`,
                    {
                      method: "POST",
                      headers: { "x-admin-token": token },
                    }
                  );
                  const data = await r.json();
                  if (!r.ok)
                    return message.error(data?.error || "No se pudo refrescar");
                  message.success("Actualizado");
                  await fetchInvoices(invPage);
                }}
              >
                Refrescar
              </Button>

              <Button
                size="small"
                danger
                disabled={disabled}
                onClick={() => {
                  setCancelRow(row);
                  cancelForm.setFieldsValue({ motive: "02", substitution: "" });
                  setCancelOpen(true);
                }}
              >
                Cancelar
              </Button>
            </div>
          );
        },
      },
    ],
    []
  );

  const customerColumns: ColumnsType<CustomerRow> = useMemo(
    () => [
      { title: "ID", dataIndex: "id", width: 80 },
      { title: "RFC", dataIndex: "taxId", width: 180 },
      { title: "Nombre/Razón", dataIndex: "legalName", width: 280 },
      { title: "Régimen", dataIndex: "taxSystem", width: 90 },
      { title: "Email", dataIndex: "email", width: 260 },
      { title: "CP", dataIndex: "zip", width: 90 },
      {
        title: "FacturapiID",
        dataIndex: "facturapiCustomerId",
        width: 220,
        render: (v) => <Text type="secondary">{v || "-"}</Text>,
      },
    ],
    []
  );

  function resetInvoicesFilters() {
    setNumcheque("");
    setFolio("");
    setCustomerQ("");
    setRange([null, null]);
  }

  function resetCustomersFilters() {
    setCustomerSearch("");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="w-full px-4 py-10">
        <Title level={3}>Admin — Facturación Cantina La Llorona</Title>
        <div className="grid grid-cols-1 md:grid-cols-5 w-full gap-3">
          <div className="col-span-5 md:col-span-4">
            <Tabs
              activeKey={activeTab}
              onChange={(k) => setActiveTab(k as any)}
              items={[
                {
                  key: "invoices",
                  label: "Facturas",
                  children: (
                    <>
                      <Card className="shadow-sm mb-4" title="Filtros">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                          <div>
                            <Text type="secondary">Numcheque</Text>
                            <Input
                              value={numcheque}
                              onChange={(e) => setNumcheque(e.target.value)}
                              placeholder="Ej: 12388"
                            />
                          </div>
                          <div>
                            <Text type="secondary">Folio</Text>
                            <Input
                              value={folio}
                              onChange={(e) => setFolio(e.target.value)}
                              placeholder="Ej: 98958"
                            />
                          </div>
                          <div>
                            <Text type="secondary">
                              Cliente (RFC / Razón / Email)
                            </Text>
                            <Input
                              value={customerQ}
                              onChange={(e) => setCustomerQ(e.target.value)}
                              placeholder="Ej: XAXX... / Juan / correo"
                            />
                          </div>
                          <div>
                            <Text type="secondary">Rango de fechas (MX)</Text>
                            <DatePicker.RangePicker
                              className="w-full"
                              value={range}
                              onChange={(v) => setRange(v as any)}
                              format="YYYY-MM-DD"
                            />
                          </div>
                        </div>

                        <div className="mt-3 flex gap-2">
                          <Button
                            type="primary"
                            onClick={() =>
                              fetchInvoices({
                                current: 1,
                                pageSize: invPage.pageSize,
                              })
                            }
                          >
                            Buscar
                          </Button>
                          <Button
                            onClick={() => {
                              resetInvoicesFilters();
                              fetchInvoices({
                                current: 1,
                                pageSize: invPage.pageSize,
                              });
                            }}
                          >
                            Limpiar
                          </Button>
                        </div>
                      </Card>

                      <Table
                        rowKey="invoiceId"
                        loading={loading}
                        dataSource={invoices}
                        columns={invoiceColumns}
                        scroll={{ x: 1400 }}
                        pagination={{
                          current: invPage.current,
                          pageSize: invPage.pageSize,
                          showSizeChanger: true,
                          pageSizeOptions: ["25", "50", "100", "200"],
                          onChange: (current, pageSize) =>
                            fetchInvoices({ current, pageSize }),
                        }}
                      />
                    </>
                  ),
                },
                {
                  key: "customers",
                  label: "Clientes",
                  children: (
                    <>
                      <Card className="shadow-sm mb-4" title="Filtros">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <Text type="secondary">
                              Buscar (RFC / Razón social / Email)
                            </Text>
                            <Input
                              value={customerSearch}
                              onChange={(e) =>
                                setCustomerSearch(e.target.value)
                              }
                              placeholder="Ej: XAXX010101000 / Cantina / correo"
                            />
                          </div>
                        </div>

                        <div className="mt-3 flex gap-2">
                          <Button
                            type="primary"
                            onClick={() =>
                              fetchCustomers({
                                current: 1,
                                pageSize: custPage.pageSize,
                              })
                            }
                          >
                            Buscar
                          </Button>
                          <Button
                            onClick={() => {
                              resetCustomersFilters();
                              fetchCustomers({
                                current: 1,
                                pageSize: custPage.pageSize,
                              });
                            }}
                          >
                            Limpiar
                          </Button>
                        </div>
                      </Card>

                      <Table
                        rowKey="id"
                        loading={loading}
                        dataSource={customers}
                        columns={customerColumns}
                        scroll={{ x: 1200 }}
                        pagination={{
                          current: custPage.current,
                          pageSize: custPage.pageSize,
                          showSizeChanger: true,
                          pageSizeOptions: ["25", "50", "100", "200"],
                          onChange: (current, pageSize) =>
                            fetchCustomers({ current, pageSize }),
                        }}
                      />
                    </>
                  ),
                },
              ]}
            />
          </div>
          <Card className="shadow-sm mb-4 col-span-5 md:col-span-1">
            <div className="w-full">
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
                <Text type="secondary">
                  Tip: las fechas se filtran en <b>hora local México</b>{" "}
                  (America/Mexico_City)
                </Text>
              </div>
            </div>
          </Card>
        </div>
        <Modal
          open={cancelOpen}
          onCancel={() => setCancelOpen(false)}
          onOk={cancelInvoice}
          confirmLoading={cancelLoading}
          title="Cancelar factura"
          okText="Enviar cancelación"
          cancelText="Cerrar"
        >
          <Form form={cancelForm} layout="vertical">
            <Form.Item
              label="Motivo SAT"
              name="motive"
              rules={[{ required: true, message: "Selecciona motivo" }]}
            >
              <Select
                options={[
                  {
                    value: "01",
                    label: "01 - Errores con relación (requiere sustitución)",
                  },
                  { value: "02", label: "02 - Errores sin relación" },
                  { value: "03", label: "03 - Operación no llevada a cabo" },
                  {
                    value: "04",
                    label: "04 - Operación nominativa relacionada a global",
                  },
                ]}
              />
            </Form.Item>

            <Form.Item shouldUpdate={(p, c) => p.motive !== c.motive} noStyle>
              {({ getFieldValue }) =>
                getFieldValue("motive") === "01" ? (
                  <Form.Item
                    label="UUID / ID de factura sustituta (substitution)"
                    name="substitution"
                    rules={[
                      { required: true, message: "Obligatorio para motivo 01" },
                    ]}
                  >
                    <Input placeholder="UUID o Facturapi invoice_id" />
                  </Form.Item>
                ) : null
              }
            </Form.Item>

            <div className="text-xs text-slate-500">
              Nota: la cancelación puede quedar <b>pending</b> si requiere
              confirmación del cliente. :contentReference[oaicite:6]
              {/* {(index = 6)} */}
            </div>
          </Form>
        </Modal>
      </div>
    </div>
  );
}
