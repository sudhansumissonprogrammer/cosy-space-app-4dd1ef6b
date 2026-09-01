import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrCode, Download } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useRef } from "react";

/* ── QR Code Generator Card ── */
export default function QRCodeGeneratorCard({ slug, customDomain }: { slug: string; customDomain: string | null }) {
  const [tableCount, setTableCount] = useState(5);
  const qrContainerRef = useRef<HTMLDivElement>(null);

  const baseUrl = customDomain
    ? `https://${customDomain}`
    : `${window.location.origin}/store/${slug}`;

  const tables = Array.from({ length: tableCount }, (_, i) => i + 1);

  const downloadQR = (tableNum: number | null) => {
    const svgEl = document.getElementById(tableNum === null ? "qr-no-table" : `qr-table-${tableNum}`);
    if (!svgEl) return;

    const svgData = new XMLSerializer().serializeToString(svgEl);
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 580;
    const ctx = canvas.getContext("2d")!;

    const img = new window.Image();
    img.onload = () => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 512, 580);
      ctx.drawImage(img, 56, 20, 400, 400);
      ctx.fillStyle = "#1a1a1a";
      ctx.font = "bold 28px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        tableNum === null ? "Scan to Order" : `Table ${tableNum}`,
        256,
        470
      );
      ctx.font = "16px sans-serif";
      ctx.fillStyle = "#666666";
      ctx.fillText("Scan QR to view menu & order", 256, 510);

      const link = document.createElement("a");
      link.download = tableNum === null ? `qr-menu.png` : `qr-table-${tableNum}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const downloadAll = () => {
    downloadQR(null);
    tables.forEach((t) => {
      setTimeout(() => downloadQR(t), t * 200);
    });
    toast.success(`Downloading ${tables.length + 1} QR codes`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <QrCode className="h-5 w-5" /> QR Code Generator
        </CardTitle>
        <CardDescription>Generate printable QR codes for each table. Customers scan to open your menu and order via WhatsApp.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Label className="text-xs">Number of Tables</Label>
            <Input
              type="number"
              min={1}
              max={50}
              value={tableCount}
              onChange={(e) => setTableCount(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
              className="mt-1"
            />
          </div>
          <Button onClick={downloadAll} variant="outline" className="mt-5">
            <Download className="mr-2 h-4 w-4" /> Download All
          </Button>
        </div>

        <div ref={qrContainerRef} className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {/* No-table QR */}
          <div className="flex flex-col items-center gap-2 rounded-xl border p-3">
            <QRCodeSVG
              id="qr-no-table"
              value={baseUrl}
              size={120}
              level="M"
              fgColor="#1a1a1a"
            />
            <p className="text-xs font-semibold">Menu (No Table)</p>
            <Button size="sm" variant="ghost" className="h-9 text-xs" onClick={() => downloadQR(null)}>
              <Download className="mr-1 h-3 w-3" /> Download
            </Button>
          </div>

          {/* Per-table QRs */}
          {tables.map((t) => (
            <div key={t} className="flex flex-col items-center gap-2 rounded-xl border p-3">
              <QRCodeSVG
                id={`qr-table-${t}`}
                value={`${baseUrl}?table=${t}`}
                size={120}
                level="M"
                fgColor="#1a1a1a"
              />
              <p className="text-xs font-semibold">Table {t}</p>
              <Button size="sm" variant="ghost" className="h-9 text-xs" onClick={() => downloadQR(t)}>
                <Download className="mr-1 h-3 w-3" /> Download
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
