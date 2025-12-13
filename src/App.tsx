import { useMemo, useState } from "react";
import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  List,
  Modal,
  Radio,
  Typography,
  message,
  Spin,
} from "antd";

import type { RadioChangeEvent } from "antd";
import dayjs, { Dayjs } from "dayjs";

const { Title, Text } = Typography;

const API = import.meta.env.VITE_API_BASE as string;

type Order = {
  id: number;
  folio: string;
  numcheque: string;
  mesa: string | null;
  fecha: string; // ISO
  cierre: string | null;
  total: number | string | null;
  subtotal: number | string | null;
  totalimpuesto1: number | string | null;
};

function todayUtcYYYYMMDD() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function App() {
  const [date, setDate] = useState<string>(() => todayUtcYYYYMMDD());
  const [numcheque, setNumcheque] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  const [invoiceId, setInvoiceId] = useState<number | null>(null);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [lastCustomerEmail, setLastCustomerEmail] = useState<string>("");
  const [zipUrl, setZipUrl] = useState<string>("");

  const [pdfUrl, setPdfUrl] = useState("");
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [loadingInvoice, setLoadingInvoice] = useState(false);

  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === selectedOrderId) || null,
    [orders, selectedOrderId]
  );

  async function lookup() {
    setInvoiceId(null);
    setPdfModalOpen(false);
    setZipUrl("");

    setPdfUrl("");
    setOrders([]);
    setSelectedOrderId(null);

    if (!date || !numcheque.trim()) {
      message.warning("Ingresa fecha y numcheque.");
      return;
    }

    setLoadingLookup(true);
    try {
      const qs = new URLSearchParams({ date, numcheque: numcheque.trim() });
      const r = await fetch(`${API}/api/orders/lookup?${qs.toString()}`);
      const data = await r.json();

      if (!r.ok) {
        message.error(data?.error || "Error buscando la orden.");
        return;
      }

      const list: Order[] = data.orders || [];
      setOrders(list);

      if (list.length === 0)
        message.info("No se encontró ninguna orden con esos datos.");
      if (list.length === 1) setSelectedOrderId(list[0].id);
      if (list.length > 1)
        message.info("Se encontraron varias. Selecciona la correcta.");
    } catch (e: any) {
      message.error(e?.message || "Error de red.");
    } finally {
      setLoadingLookup(false);
    }
  }

  async function generarFactura(values: any) {
    if (!selectedOrderId) {
      message.warning("Selecciona una orden.");
      return;
    }

    setPdfUrl("");
    setLoadingInvoice(true);
    try {
      const r = await fetch(`${API}/api/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: selectedOrderId,
          customer: {
            legalName: values.legalName,
            taxId: values.taxId,
            taxSystem: values.taxSystem,
            email: values.email,
            address: { zip: values.zip },
          },

          cfdiUse: values.cfdiUse || "G03",
          paymentForm: values.paymentForm || "03",
        }),
      });

      const data = await r.json();
      if (!r.ok) {
        message.error(data?.error || "Error al generar la factura.");
        return;
      }

      setInvoiceId(data.invoiceId ?? null);
      setPdfUrl(`${API}${data.pdfUrl}`);
      setZipUrl(data.zipUrl ? `${API}${data.zipUrl}` : "");
      setLastCustomerEmail(values.email || "");
      setPdfModalOpen(true);
      message.success("Factura generada.");
    } catch (e: any) {
      message.error(e?.message || "Error de red.");
    } finally {
      setLoadingInvoice(false);
    }
  }
  async function enviarFacturaEmail() {
    if (!invoiceId) {
      message.warning("No hay invoiceId para enviar.");
      return;
    }
    if (!lastCustomerEmail) {
      message.warning("No capturaste email del cliente.");
      return;
    }

    setSendingEmail(true);
    try {
      const r = await fetch(`${API}/api/invoices/${invoiceId}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await r.json();
      if (!r.ok) {
        message.error(data?.error || "Error enviando email.");
        return;
      }
      message.success(`Enviado a ${lastCustomerEmail}`);
    } catch (e: any) {
      message.error(e?.message || "Error de red.");
    } finally {
      setSendingEmail(false);
    }
  }

  const dateValue: Dayjs | null = date ? dayjs(date, "YYYY-MM-DD") : null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-6">
          <Title level={2} className="mb-1">
            Solicitar factura
          </Title>
          <Text type="secondary">
            Busca tu consumo por <b>fecha</b> y <b>numcheque</b>. Si hay
            duplicados, elige el correcto.
          </Text>
        </div>

        <Card className="shadow-sm" title="1) Buscar tu consumo">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:items-end">
            <div>
              <Text className="block mb-1" type="secondary">
                Fecha (YYYY-MM-DD)
              </Text>
              <DatePicker
                className="w-full"
                value={dateValue}
                format="YYYY-MM-DD"
                onChange={(v) => setDate(v ? v.format("YYYY-MM-DD") : "")}
                placeholder="YYYY-MM-DD"
              />
            </div>

            <div>
              <Text className="block mb-1" type="secondary">
                Numcheque
              </Text>
              <Input
                value={numcheque}
                onChange={(e) => setNumcheque(e.target.value)}
                placeholder="Ej: 12345"
              />
            </div>
            <Text className="block mt-1 text-xs" type="secondary">
              Tip: tu API busca por rango UTC del día.
            </Text>
            <Button type="primary" onClick={lookup} disabled={loadingLookup}>
              {loadingLookup ? (
                <>
                  <Spin size="small" />{" "}
                  <span className="ml-2">Buscando...</span>
                </>
              ) : (
                "Buscar"
              )}
            </Button>
          </div>

          {orders.length > 0 && (
            <div className="mt-5">
              <Text strong>Resultados</Text>

              <div className="mt-3">
                <Radio.Group
                  onChange={(e: RadioChangeEvent) =>
                    setSelectedOrderId(Number(e.target.value))
                  }
                  value={selectedOrderId ?? undefined}
                  className="w-full"
                >
                  <List
                    bordered
                    dataSource={orders}
                    renderItem={(o) => (
                      <List.Item className="px-3">
                        <Radio value={o.id} className="w-full">
                          <div className="flex flex-col gap-1">
                            <div className="font-semibold">
                              Folio: {o.folio} · Numcheque: {o.numcheque} · ID:{" "}
                              {o.id}
                            </div>
                            <div className="text-slate-600 text-sm">
                              Fecha: {o.fecha}{" "}
                              {o.mesa ? `· Mesa: ${o.mesa}` : ""} · Total:{" "}
                              {String(o.total ?? "")}
                            </div>
                          </div>
                        </Radio>
                      </List.Item>
                    )}
                  />
                </Radio.Group>
              </div>
            </div>
          )}
        </Card>

        <div className="mt-6">
          <Card
            className="shadow-sm"
            title="2) Datos fiscales"
            extra={
              selectedOrder ? (
                <Text type="secondary">
                  Orden: <b>ID {selectedOrder.id}</b> · Total:{" "}
                  <b>{String(selectedOrder.total ?? "")}</b>
                </Text>
              ) : (
                <Text type="secondary">
                  Selecciona una orden para continuar
                </Text>
              )
            }
          >
            <Form
              layout="vertical"
              onFinish={generarFactura}
              disabled={!selectedOrder}
            >
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Form.Item
                  label="Razón social / Nombre"
                  name="legalName"
                  rules={[
                    { required: true, message: "Este campo es obligatorio" },
                  ]}
                >
                  <Input placeholder="Ej: Juan Pérez SA de CV" />
                </Form.Item>
                <Form.Item
                  label="Régimen fiscal (taxSystem)"
                  name="taxSystem"
                  initialValue="601"
                  rules={[
                    { required: true, message: "Este campo es obligatorio" },
                    { len: 3, message: "Debe ser de 3 caracteres (ej: 601)" },
                  ]}
                >
                  <Input placeholder="601" />
                </Form.Item>

                <Form.Item
                  label="RFC"
                  name="taxId"
                  rules={[
                    { required: true, message: "Este campo es obligatorio" },
                  ]}
                >
                  <Input placeholder="Ej: XAXX010101000" />
                </Form.Item>

                <Form.Item label="Email" name="email">
                  <Input placeholder="correo@ejemplo.com" />
                </Form.Item>

                <Form.Item label="Código Postal (CP)" name="zip">
                  <Input placeholder="Ej: 03100" />
                </Form.Item>

                <Form.Item label="Uso CFDI" name="cfdiUse" initialValue="G03">
                  <Input placeholder="G03" />
                </Form.Item>

                <Form.Item
                  label="Forma de pago"
                  name="paymentForm"
                  initialValue="03"
                >
                  <Input placeholder="03" />
                </Form.Item>
              </div>

              <Button type="primary" htmlType="submit" loading={loadingInvoice}>
                Generar factura
              </Button>
            </Form>
          </Card>
        </div>

        <Modal
          open={pdfModalOpen}
          onCancel={() => setPdfModalOpen(false)}
          footer={null}
          width={980}
          title="Factura (PDF)"
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button href={pdfUrl} target="_blank" disabled={!pdfUrl}>
                Abrir / Descargar PDF
              </Button>

              <Button href={zipUrl} target="_blank" disabled={!zipUrl}>
                Descargar ZIP (PDF+XML)
              </Button>

              <Button
                type="primary"
                onClick={enviarFacturaEmail}
                loading={sendingEmail}
                disabled={!invoiceId || !lastCustomerEmail}
              >
                Enviar a email
              </Button>

              <Text type="secondary" className="truncate">
                {lastCustomerEmail
                  ? `Enviar a: ${lastCustomerEmail}`
                  : "Sin email capturado"}
              </Text>
            </div>

            <div className="h-[350px] w-full overflow-hidden rounded-lg border border-slate-200 bg-white">
              <iframe src={pdfUrl} className="h-full w-full" />
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}
