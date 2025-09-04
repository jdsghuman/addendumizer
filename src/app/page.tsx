"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

/** Parse a user-entered string to a number, keeping decimals */
function toNumber(raw: string | number): number {
  const cleaned = String(raw).replace(/[^\d.]/g, "");
  return cleaned === "" ? 0 : parseFloat(cleaned);
}

/** Format a number as $X,XXX.XX */
function fmtUSD(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** Borderless currency input (fixed width) */
type CurrencyInputProps = {
  value: number;
  onChange: (n: number) => void;
  ariaLabel: string;
};

const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onChange,
  ariaLabel,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState<string>(String(value));

  useEffect(() => {
    if (!isEditing) setText(String(value));
  }, [value, isEditing]);

  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={ariaLabel}
      className="w-48 bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-right"
      value={isEditing ? text : fmtUSD(value)}
      onFocus={(e) => {
        setIsEditing(true);
        setText(String(value));
        requestAnimationFrame(() => e.currentTarget.select());
      }}
      onChange={(e) => {
        const t = e.target.value;
        setText(t);
        onChange(toNumber(t));
      }}
      onBlur={() => setIsEditing(false)}
    />
  );
};

/** Borderless inline editable text that shrinks to content (for tenant + dates) */
type EditableInlineProps = {
  value: string;
  onChange: (s: string) => void;
  ariaLabel: string;
  maxLength?: number;
  className?: string;
  placeholder?: string;
};

const EditableInline: React.FC<EditableInlineProps> = ({
  value,
  onChange,
  ariaLabel,
  maxLength = 100,
  className,
  placeholder = "",
}) => {
  const ch = Math.max((value || "").length, 1); // track width with content

  return (
    <input
      type="text"
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={value}
      size={ch} // input width follows content length
      onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
      className={`bg-transparent border-none outline-none focus:outline-none focus:ring-0
                  w-auto min-w-0 inline p-0 m-0 align-baseline ${
                    className || ""
                  }`}
    />
  );
};

/** ------- Addendum custom lines ------- */
type AddendumLine = { id: string; text: string };
const uid = () => Math.random().toString(36).slice(2, 9);

const AddendumPage: React.FC = () => {
  const contentRef = useRef<HTMLDivElement | null>(null);

  // Editable amounts
  const [baseRent, setBaseRent] = useState<number>(0);
  const [insurance, setInsurance] = useState<number>(0);
  const [rsTax, setRsTax] = useState<number>(0);
  const [cam, setCam] = useState<number>(0);

  // Auto total
  const totalRent = useMemo(
    () => baseRent + insurance + rsTax + cam,
    [baseRent, insurance, rsTax, cam]
  );

  // Editable header + sentence fields
  const [addendumLetter, setAddendumLetter] = useState<string>("");
  const [initialDate, setInitialDate] = useState<string>("");
  const [tenantName, setTenantName] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [lesseeCompanyName, setLesseeCompanyName] = useState<string>("");
  const [lesseeCompanyName2, setLesseeCompanyName2] = useState<string>("");
  const [lesseeName, setLesseeName] = useState<string>("");
  const [lesseeName2, setLesseeName2] = useState<string>("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [lesseeCount, setLesseeCount] = useState(1);

  // For conditional width classes (preserve your widths only when filled)
  const hasTenant = tenantName.trim().length > 0;
  const hasInitialDate = initialDate.trim().length > 0;
  const hasStartDate = startDate.trim().length > 0;
  const hasEndDate = endDate.trim().length > 0;

  // Custom addendum lines
  const [lines, setLines] = useState<AddendumLine[]>([]);
  const addLine = () => setLines((prev) => [...prev, { id: uid(), text: "" }]);
  const updateLine = (id: string, text: string) =>
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, text } : l)));
  const removeLine = (id: string) =>
    setLines((prev) => prev.filter((l) => l.id !== id));

  const handleDownloadPDF = async (): Promise<void> => {
    const node = contentRef.current;
    if (!node) return;
    setIsDownloading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((document as any).fonts?.ready) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (document as any).fonts.ready;
    }

    const canvas = await html2canvas(node, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
    });
    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save("addendum.pdf");
  };

  const handleAddLessee = () => {
    if (lesseeCount === 1) {
      setLesseeCount(2);
    }
  };

  useEffect(() => {
    if (isDownloading) {
      const timer = setTimeout(() => setIsDownloading(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isDownloading]);

  return (
    <div className="font-sans min-h-screen flex justify-center p-8 sm:p-20">
      <div className="max-w-[1200px] w-full mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={handleDownloadPDF}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Download PDF
          </button>

          {/* Add line button (kept OUTSIDE the capture area so it never prints) */}
          <button
            type="button"
            onClick={addLine}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 text-sm hover:bg-gray-50"
            title="Add line"
          >
            {/* plus icon (SVG) */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Add line
          </button>
        </div>

        {/* Capture area */}
        <div ref={contentRef} className="p-0 sm:p-8 md:p-16 bg-white">
          <h1 className="text-xl sm:text-2xl font-extrabold text-center">
            Addendum{" "}
            <span className="inline-flex items-baseline">
              {"“"}
              {!isDownloading ? (
                <EditableInline
                  value={addendumLetter}
                  onChange={(e) =>
                    setAddendumLetter(
                      e.replace(/[“”"]/g, "").toUpperCase().slice(0, 1)
                    )
                  }
                  ariaLabel="Addendum letter"
                  className="text-center
                         placeholder-shown:bg-[#fecaca] placeholder-shown:text-red-800
                         placeholder-shown:outline placeholder-shown:outline-red-500"
                  placeholder="A"
                />
              ) : (
                <p>{addendumLetter}</p>
              )}
              {"”"}
            </span>
          </h1>

          {/* Sentence with editable tenant/date */}
          <p className="mt-4 mx-auto max-w-[800px] text-center leading-7">
            ADDENDUM TO LEASE, dated{" "}
            {!isDownloading ? (
              <EditableInline
                value={initialDate}
                ariaLabel="Initial date"
                className={`text-center w-auto inline p-0 m-0 align-baseline
                         ${hasInitialDate ? "min-w-0" : "min-w-28"}
                         placeholder-shown:bg-[#fecaca] placeholder-shown:text-red-800
                         placeholder-shown:outline placeholder-shown:outline-1 placeholder-shown:outline-red-500`}
                placeholder="May 1st, 2025"
                onChange={(e) => setInitialDate(e.replace(/[“”"]/g, ""))}
              />
            ) : (
              <span>{initialDate}</span>
            )}{" "}
            by and between “AKAL GROUP LLC D/B/A LAKE DEXTER PLAZA” (Landlord)
            and
            {" “"}
            {!isDownloading ? (
              <EditableInline
                value={tenantName}
                onChange={(v) => setTenantName(v.replace(/[“”"]/g, ""))}
                ariaLabel="Tenant name"
                className={`text-center w-auto inline p-0 m-0 align-baseline
                         ${hasTenant ? "min-w-0" : "min-w-24"}
                         placeholder-shown:bg-[#fecaca] placeholder-shown:text-red-800
                         placeholder-shown:outline placeholder-shown:outline-1 placeholder-shown:outline-red-500`}
                placeholder="Tenant name"
              />
            ) : (
              <span>{tenantName}</span>
            )}
            {"” "}
            (Tenant).
          </p>

          {/* Flexbox: dates (left) + amounts (right) */}
          <div className="flex flex-col sm:flex-row my-8 sm:my-20 items-center sm:items-baseline justify-center">
            {/* Dates: preserve your column gap via mr-36 */}
            <div className="font-bold mr-0 mb-4 sm:mb-0 sm:mr-36">
              {!isDownloading ? (
                <EditableInline
                  value={startDate}
                  onChange={setStartDate}
                  ariaLabel="Start date"
                  className={`text-right w-auto inline p-0 m-0 align-baseline
                           ${hasStartDate ? "min-w-0" : "min-w-28"}
                           placeholder-shown:bg-[#fecaca] placeholder-shown:text-red-800
                           placeholder-shown:outline placeholder-shown:outline-1 placeholder-shown:outline-red-500`}
                  maxLength={10}
                  placeholder="MM/DD/YYYY"
                />
              ) : (
                <span>{startDate}</span>
              )}{" "}
              to{" "}
              {!isDownloading ? (
                <EditableInline
                  value={endDate}
                  onChange={setEndDate}
                  ariaLabel="End date"
                  className={`text-left w-auto inline p-0 m-0 align-baseline
                           ${hasEndDate ? "min-w-0" : "min-w-28"}
                           placeholder-shown:bg-[#fecaca] placeholder-shown:text-red-800
                           placeholder-shown:outline placeholder-shown:outline-1 placeholder-shown:outline-red-500`}
                  maxLength={10}
                  placeholder="MM/DD/YYYY"
                />
              ) : (
                <span>{endDate}</span>
              )}
            </div>

            {/* Amounts: keep fixed width for alignment */}
            <div className="w-[275px] md:w-[400px]">
              <div className="flex items-center justify-between gap-6">
                <label className="font-medium">Base Rent</label>
                <CurrencyInput
                  value={baseRent}
                  onChange={setBaseRent}
                  ariaLabel="Base Rent"
                />
              </div>

              <div className="flex items-center justify-between gap-6">
                <label className="font-medium">Insurance</label>
                <CurrencyInput
                  value={insurance}
                  onChange={setInsurance}
                  ariaLabel="Insurance"
                />
              </div>

              <div className="flex items-center justify-between gap-6">
                <label className="font-medium whitespace-nowrap">
                  R.S. Tax
                </label>
                <CurrencyInput
                  value={rsTax}
                  onChange={setRsTax}
                  ariaLabel="R.S. Tax"
                />
              </div>

              <div className="flex items-center justify-between gap-6">
                <label className="font-medium">CAM</label>
                <CurrencyInput value={cam} onChange={setCam} ariaLabel="CAM" />
              </div>

              <hr className="my-2" />

              <div className="flex items-center justify-between gap-6">
                <div className="font-semibold">Total Rent</div>
                <div className="font-semibold w-48 text-right">
                  {fmtUSD(totalRent)}
                </div>
              </div>
            </div>
          </div>

          <p className="text-md mt-2">
            All other items, conditions, and provisions of the original lease
            shall remain in full force and effect.
          </p>
          {/* Custom addendum lines (printable; delete icon ignored in PDF) */}
          {lines.length > 0 && (
            <div className="mt-10 space-y-2">
              {lines.map((line) => (
                <div key={line.id} className="flex items-start gap-0">
                  <span className="select-none"></span>
                  <input
                    type="text"
                    value={line.text}
                    placeholder="Custom addendum line"
                    onChange={(e) => updateLine(line.id, e.target.value)}
                    className="flex-1 bg-transparent border-none outline-none focus:outline-none focus:ring-0
                               placeholder-shown:bg-[#fecaca] placeholder-shown:text-red-800
                               placeholder-shown:outline placeholder-shown:outline-1 placeholder-shown:outline-red-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeLine(line.id)}
                    className="p-1 text-gray-500 hover:text-gray-800"
                    title="Remove line"
                    data-html2canvas-ignore="true"
                    aria-label="Remove line"
                  >
                    {/* trash icon */}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                      <path d="M10 11v6"></path>
                      <path d="M14 11v6"></path>
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
          {!isDownloading && (
            <div className="mt-20 flex">
              <button
                type="button"
                onClick={handleAddLessee}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 text-sm hover:bg-gray-50"
                title="Add line"
              >
                {/* plus icon (SVG) */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Add LESSEE
              </button>
              {lesseeCount === 2 && (
                <button
                  type="button"
                  onClick={() => setLesseeCount(1)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 text-sm hover:bg-gray-50 ml-4 bg-red-500"
                  title="Add line"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="pointer-events-none"
                  >
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              )}
            </div>
          )}
          <div
            className={`mx-auto mt-2 ${
              lesseeCount === 1 ? "max-w-[700]" : "max-w-[1200]"
            } flex flex-col lg:flex-row gap-12 sm:gap-0 justify-between font-sans ${
              isDownloading ? "mt-18" : ""
            }`}
          >
            <div>
              <p className="mb-2 underline">LESSOR:</p>
              <p>AKAL GROUP LLC D/B/A</p>
              <p>LAKE DEXTER PLAZA</p>
              <p className="mt-12">By:______________________________</p>
              <p className="ml-8">J.S. Ghuman</p>
              <p className="mt-12">Date:____________________________</p>
            </div>
            <div>
              <p className="mb-2 mt-8 md:mt-0 underline">LESSEE:</p>
              <p>
                <EditableInline
                  value={lesseeCompanyName}
                  onChange={(v) =>
                    setLesseeCompanyName(v.replace(/[“”"]/g, "").toUpperCase())
                  }
                  ariaLabel="Tenant name"
                  className={`text-center w-auto inline p-0 m-0 align-baseline
                         ${lesseeCompanyName ? "min-w-0" : "min-w-24"}
                         placeholder-shown:bg-[#fecaca] placeholder-shown:text-red-800
                         placeholder-shown:outline placeholder-shown:outline-red-500`}
                  placeholder="Tenant name"
                />
              </p>
              <p className="mt-18">By:______________________________</p>
              <p className="ml-8">
                {!isDownloading ? (
                  <EditableInline
                    value={lesseeName}
                    onChange={(v) => setLesseeName(v.replace(/[“”"]/g, ""))}
                    ariaLabel="Lessee name"
                    className={`text-center w-auto inline p-0 m-0 align-baseline
                         ${lesseeName ? "min-w-0" : "min-w-24"}
                         placeholder-shown:bg-[#fecaca] placeholder-shown:text-red-800
                         placeholder-shown:outline placeholder-shown:outline-red-500`}
                    placeholder="Lessee name"
                  />
                ) : (
                  <span>{lesseeName}</span>
                )}
              </p>
              <p className="mt-12">Date:____________________________</p>
            </div>
            {lesseeCount === 2 && (
              <div>
                <p className="mb-2 mt-8 md:mt-0 underline">LESSEE:</p>
                <p>
                  <EditableInline
                    value={lesseeCompanyName}
                    onChange={(v) =>
                      setLesseeCompanyName(
                        v.replace(/[“”"]/g, "").toUpperCase()
                      )
                    }
                    ariaLabel="Tenant name"
                    className={`text-center w-auto inline p-0 m-0 align-baseline
                         ${lesseeCompanyName ? "min-w-0" : "min-w-24"}
                         placeholder-shown:bg-[#fecaca] placeholder-shown:text-red-800
                         placeholder-shown:outline placeholder-shown:outline-red-500`}
                    placeholder="Tenant name"
                  />
                </p>
                <p className="mt-18">By:______________________________</p>
                <p className="ml-8">
                  {!isDownloading ? (
                    <EditableInline
                      value={lesseeName2}
                      onChange={(v) => setLesseeName2(v.replace(/[“”"]/g, ""))}
                      ariaLabel="Lessee name"
                      className={`text-center w-auto inline p-0 m-0 align-baseline
                         ${lesseeName2 ? "min-w-0" : "min-w-24"}
                         placeholder-shown:bg-[#fecaca] placeholder-shown:text-red-800
                         placeholder-shown:outline placeholder-shown:outline-red-500`}
                      placeholder="Lessee name"
                    />
                  ) : (
                    <span>{lesseeName2}</span>
                  )}
                </p>
                <p className="mt-12">Date:____________________________</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddendumPage;
