import React, { useEffect, useMemo, useRef, useState } from "react";
import { User } from "../types";
import { eventService, EventFormField, EventItem, EventRegistrationItem } from "../services/events";
import { Html5QrcodeScanner } from "html5-qrcode";

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:8000";

type Props = {
  user: User;
};

const COMMON_DEPTS = [
  "Computer Science",
  "Information Technology",
  "Electronics and Communication",
  "Electrical and Electronics",
  "Mechanical",
  "Civil",
  "Artificial Intelligence and Data Science",
];

const slugKey = (label: string) =>
  (label || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "field";

const toIsoFromLocal = (local: string): string => {
  const d = new Date(local);
  return d.toISOString();
};

const EventManagerEventsPage: React.FC<Props> = ({ user }) => {
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<EventItem[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [venue, setVenue] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");

  const [allDepts, setAllDepts] = useState(true);
  const [allowedDepartments, setAllowedDepartments] = useState<string[]>([]);
  const [customDept, setCustomDept] = useState("");

  const [fields, setFields] = useState<EventFormField[]>([
    { key: "roll_no", label: "Roll Number", type: "text", required: true },
    { key: "full_name", label: "Full Name", type: "text", required: true },
    { key: "phone", label: "Phone Number", type: "text", required: true },
  ]);

  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [createPosterFile, setCreatePosterFile] = useState<File | null>(null);
  const createPosterInputRef = useRef<HTMLInputElement | null>(null);

  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const posterInputRef = useRef<HTMLInputElement | null>(null);

  const [regsEvent, setRegsEvent] = useState<EventItem | null>(null);
  const [registrations, setRegistrations] = useState<EventRegistrationItem[]>([]);
  const [loadingRegs, setLoadingRegs] = useState(false);
  const [modalTab, setModalTab] = useState<"list" | "attendance">("list");
  const [scannerActive, setScannerActive] = useState(false);
  const [manualRoll, setManualRoll] = useState("");
  const [markingAtt, setMarkingAtt] = useState(false);
  const [confirming, setConfirming] = useState<{ id: string, status: boolean } | null>(null);

  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  const refresh = async () => {
    setLoading(true);
    const list = await eventService.listMine(user);
    setEvents(list);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.email]);

  useEffect(() => {
    let scanner: any = null;

    if (modalTab === "attendance" && scannerActive) {
      const timer = setTimeout(async () => {
        const element = document.getElementById("qr-reader");
        if (element && !scannerRef.current) {
          try {
            const { Html5Qrcode } = await import("html5-qrcode");
            scanner = new Html5Qrcode("qr-reader");
            scannerRef.current = scanner;

            await scanner.start(
              { facingMode: "environment" },
              { fps: 10, qrbox: { width: 300, height: 150 } }, // Barcode friendly
              async (decodedText: string) => {
                setManualRoll(decodedText.trim());
                setScannerActive(false); // Stop to allow confirmation
              },
              () => { }
            );
          } catch (err) {
            console.error("Scanner error:", err);
            setError("Could not start camera.");
            setScannerActive(false);
          }
        }
      }, 300);

      return () => {
        clearTimeout(timer);
        if (scannerRef.current) {
          scannerRef.current.stop().then(() => {
            scannerRef.current = null;
          }).catch(() => { });
        }
      };
    }
  }, [modalTab, scannerActive]);

  const visibleAllowedDepts = useMemo(() => (allDepts ? [] : allowedDepartments), [allDepts, allowedDepartments]);

  const addField = () => {
    const key = `field_${Date.now()}`;
    setFields((prev) => [...prev, { key, label: "New Field", type: "text", required: false }]);
  };

  const updateField = (idx: number, patch: Partial<EventFormField>) => {
    setFields((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };

  const removeField = (idx: number) => {
    setFields((prev) => prev.filter((_, i) => i !== idx));
  };

  const toggleDept = (d: string) => {
    setAllowedDepartments((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setVenue("");
    setStartAt("");
    setEndAt("");
    setAllDepts(true);
    setAllowedDepartments([]);
    setFields([
      { key: "roll_no", label: "Roll Number", type: "text", required: true },
      { key: "full_name", label: "Full Name", type: "text", required: true },
      { key: "phone", label: "Phone Number", type: "text", required: true },
    ]);
    setCreatePosterFile(null);
    setEditingEventId(null);
  };

  const editEvent = (ev: EventItem) => {
    setEditingEventId(ev.id);
    setTitle(ev.title);
    setDescription(ev.description);
    setVenue(ev.venue || "");
    // Convert ISO to local for input
    const toLocal = (iso: string) => {
      if (!iso) return "";
      const d = new Date(iso);
      const tzOffset = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
    };
    setStartAt(toLocal(ev.startAt));
    setEndAt(ev.endAt ? toLocal(ev.endAt) : "");
    setAllDepts(ev.allowedDepartments.length === 0);
    setAllowedDepartments(ev.allowedDepartments);
    setFields(ev.formFields);
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const addCustomDept = () => {
    const d = customDept.trim();
    if (!d) return;
    setAllowedDepartments((prev) => (prev.includes(d) ? prev : [...prev, d]));
    setCustomDept("");
  };

  const createEvent = async () => {
    setToast(null);
    setError(null);

    if (!title.trim() || title.trim().length < 3) {
      setError("Please enter a valid title.");
      return;
    }
    if (!description.trim() || description.trim().length < 3) {
      setError("Please enter a valid description.");
      return;
    }
    if (!startAt) {
      setError("Please choose a start date/time.");
      return;
    }

    if (new Date(startAt) < new Date()) {
      setError("Start date/time cannot be in the past.");
      return;
    }

    if (endAt && new Date(endAt) < new Date(startAt)) {
      setError("End date/time cannot be before start date/time.");
      return;
    }

    if (!allDepts && allowedDepartments.length === 0) {
      setError("Select at least one allowed department (or enable All departments).");
      return;
    }

    // Validate form fields
    for (const f of fields) {
      if (!f.label.trim()) {
        setError("All form fields must have a label.");
        return;
      }
      if (f.type === "select" && (!f.options || f.options.filter(Boolean).length === 0)) {
        setError(`Field "${f.label}" of type Select must have at least one option.`);
        return;
      }
    }

    const payload = {
      title: title.trim(),
      description: description.trim(),
      venue: venue.trim() || undefined,
      startAt: toIsoFromLocal(startAt),
      endAt: endAt ? toIsoFromLocal(endAt) : undefined,
      allowedDepartments: visibleAllowedDepts,
      formFields: fields.map((f) => ({
        key: (f.key || slugKey(f.label)).trim() || `field_${Date.now()}`,
        label: (f.label || "Field").trim(),
        type: f.type,
        required: !!f.required,
        options: f.type === "select" ? (f.options || []).filter(Boolean) : undefined,
      })),
    };

    let res;
    if (editingEventId) {
      res = await eventService.updateEvent(user, editingEventId, payload);
    } else {
      res = await eventService.createEvent(user, payload);
    }
    if (res.success) {
      setToast(editingEventId ? "Event updated." : "Event created. Upload poster for better reach.");

      const newlyCreatedId = !editingEventId ? (res as any).eventId : null;

      resetForm();

      if (newlyCreatedId && createPosterFile) {
        const up = await eventService.uploadPoster(user, newlyCreatedId, createPosterFile);
        if (up.success) {
          setToast("Event created and poster uploaded.");
        } else {
          setToast("Event created, but poster upload failed.");
          setError(up.message || "Poster upload failed");
        }
      }

      await refresh();
      return;
    }

    setError(res.message || "Failed to create event");
  };

  const uploadPoster = async (eventId: string) => {
    setToast(null);
    setError(null);
    if (!posterFile) {
      setError("Please choose a poster image (PNG/JPG).");
      return;
    }
    const res = await eventService.uploadPoster(user, eventId, posterFile);
    if (res.success) {
      setToast("Poster uploaded.");
      setPosterFile(null);
      setUploadingFor(null);
      await refresh();
      return;
    }
    setError(res.message || "Poster upload failed");
  };

  const openRegistrations = async (ev: EventItem) => {
    setRegsEvent(ev);
    setRegistrations([]);
    setLoadingRegs(true);
    setModalTab("list");
    const list = await eventService.listRegistrations(user, ev.id);
    setRegistrations(list);
    setLoadingRegs(false);
  };

  const handleMarkAttendance = async (id: string, status: boolean = true) => {
    if (!regsEvent || !id.trim()) return;
    setMarkingAtt(true);
    const res = await eventService.markAttendance(user, regsEvent.id, id.trim(), status);
    setMarkingAtt(false);
    setConfirming(null);
    if (res.success) {
      setToast(res.message);
      setError(null);
      setManualRoll("");
      // refresh registrations list
      const list = await eventService.listRegistrations(user, regsEvent.id);
      setRegistrations(list);
    } else {
      setError(res.message);
      setToast(null);
    }
  };

  const downloadReport = () => {
    if (!regsEvent) return;
    const url = eventService.getAttendanceReportUrl(user, regsEvent.id);
    window.open(url, "_blank");
  };

  const posterUrl = (ev: EventItem) => {
    const url = ev.poster?.url;
    if (!url) return null;
    try {
      return new URL(String(url), API_BASE_URL).toString();
    } catch {
      return String(url);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
        <h2 className="text-2xl font-black text-slate-800">Event Manager Home • Publish Events</h2>
        <p className="mt-2 text-slate-500 font-bold">Post event posters, set department visibility, and create registration forms.</p>

        {(toast || error) && (
          <div
            className={`mt-5 p-4 rounded-2xl border font-bold ${error ? "bg-rose-50 text-rose-700 border-rose-100" : "bg-emerald-50 text-emerald-700 border-emerald-100"
              }`}
          >
            {error || toast}
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-50 rounded-2xl border border-slate-100 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-800">{editingEventId ? "Edit Event" : "Create Event"}</h3>
              {editingEventId && (
                <button
                  onClick={resetForm}
                  className="text-xs font-black text-indigo-600 hover:text-indigo-700"
                >
                  Clear & Create New
                </button>
              )}
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Title *</p>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-2 w-full p-4 rounded-2xl bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                />
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Description *</p>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-2 w-full min-h-[120px] p-4 rounded-2xl bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Start *</p>
                  <input
                    type="datetime-local"
                    value={startAt}
                    onChange={(e) => setStartAt(e.target.value)}
                    className="mt-2 w-full p-4 rounded-2xl bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">End (optional)</p>
                  <input
                    type="datetime-local"
                    value={endAt}
                    onChange={(e) => setEndAt(e.target.value)}
                    className="mt-2 w-full p-4 rounded-2xl bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                  />
                </div>
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Venue (optional)</p>
                <input
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  className="mt-2 w-full p-4 rounded-2xl bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                />
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-black text-slate-800">Visibility</p>
                  <label className="flex items-center gap-2 text-xs font-black text-slate-600">
                    <input
                      type="checkbox"
                      checked={allDepts}
                      onChange={(e) => {
                        setAllDepts(e.target.checked);
                        if (e.target.checked) setAllowedDepartments([]);
                      }}
                    />
                    All departments
                  </label>
                </div>

                {!allDepts && (
                  <div className="mt-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Allowed Departments</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {COMMON_DEPTS.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => toggleDept(d)}
                          className={`px-3 py-2 rounded-xl border text-xs font-black ${allowedDepartments.includes(d)
                            ? "bg-indigo-50 text-indigo-700 border-indigo-100"
                            : "bg-slate-50 text-slate-600 border-slate-200"
                            }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>

                    <div className="mt-3 flex gap-2">
                      <input
                        value={customDept}
                        onChange={(e) => setCustomDept(e.target.value)}
                        placeholder="Add custom department"
                        className="flex-1 p-3 rounded-xl bg-slate-50 border border-slate-200 font-bold"
                      />
                      <button
                        type="button"
                        onClick={addCustomDept}
                        className="px-4 py-3 bg-slate-900 text-white rounded-xl font-black text-xs"
                      >
                        Add
                      </button>
                    </div>

                    {allowedDepartments.length === 0 && (
                      <p className="mt-2 text-xs font-bold text-rose-600">Select at least one department or turn on All departments.</p>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <p className="font-black text-slate-800">Event Poster (optional)</p>
                <p className="mt-1 text-xs font-bold text-slate-500">PNG/JPG, max 5MB. If chosen, it uploads right after event creation.</p>
                <input
                  ref={createPosterInputRef}
                  className="hidden"
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(e) => setCreatePosterFile(e.target.files?.[0] || null)}
                />

                <div className="mt-3 flex flex-col sm:flex-row gap-3 sm:items-center">
                  <button
                    type="button"
                    onClick={() => createPosterInputRef.current?.click()}
                    className="px-6 py-3 bg-slate-900 text-white font-black rounded-2xl text-sm hover:bg-slate-800 transition-all"
                  >
                    {createPosterFile ? "Change file" : "Choose file"}
                  </button>

                  <div className="flex-1 px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-700 break-all">
                    {createPosterFile ? createPosterFile.name : "No file selected"}
                  </div>

                  {createPosterFile ? (
                    <button
                      type="button"
                      onClick={() => {
                        setCreatePosterFile(null);
                        if (createPosterInputRef.current) createPosterInputRef.current.value = "";
                      }}
                      className="px-5 py-3 bg-slate-100 text-slate-700 font-black rounded-2xl text-sm border border-slate-200 hover:bg-slate-200 transition-all"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-black text-slate-800">Registration Form</p>
                  <button onClick={addField} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-black text-xs border border-slate-200">
                    Add Field
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {fields.map((f, idx) => (
                    <div key={idx} className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Label *</p>
                          <input
                            value={f.label}
                            onChange={(e) => {
                              const label = e.target.value;
                              updateField(idx, { label, key: f.key || slugKey(label) });
                            }}
                            className="mt-2 w-full p-3 rounded-xl bg-white border border-slate-200 font-bold"
                          />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Key *</p>
                          <input
                            value={f.key}
                            onChange={(e) => updateField(idx, { key: e.target.value })}
                            className="mt-2 w-full p-3 rounded-xl bg-white border border-slate-200 font-bold"
                          />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Type *</p>
                          <select
                            value={f.type}
                            onChange={(e) => updateField(idx, { type: e.target.value as any })}
                            className="mt-2 w-full p-3 rounded-xl bg-white border border-slate-200 font-bold"
                          >
                            <option value="text">Text</option>
                            <option value="textarea">Textarea</option>
                            <option value="select">Select</option>
                          </select>
                        </div>
                        <div className="flex items-end justify-between gap-3">
                          <label className="flex items-center gap-2 text-xs font-black text-slate-600">
                            <input
                              type="checkbox"
                              checked={!!f.required}
                              onChange={(e) => updateField(idx, { required: e.target.checked })}
                            />
                            Required
                          </label>
                          <button onClick={() => removeField(idx)} className="px-3 py-2 bg-rose-50 text-rose-700 rounded-xl font-black text-xs border border-rose-100">
                            Remove
                          </button>
                        </div>
                      </div>

                      {f.type === "select" && (
                        <div className="mt-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Options (comma separated)</p>
                          <input
                            value={(f.options || []).join(", ")}
                            onChange={(e) => updateField(idx, { options: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })}
                            className="mt-2 w-full p-3 rounded-xl bg-white border border-slate-200 font-bold"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={createEvent}
                className="w-full mt-2 px-6 py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg hover:bg-indigo-700 transition-all active:scale-[0.98]"
              >
                {editingEventId ? "Update Event" : "Create Event"}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-800">My Events</h3>
              <button onClick={refresh} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-black text-xs border border-slate-200">
                Refresh
              </button>
            </div>

            {loading ? (
              <p className="mt-4 text-sm text-slate-500 font-bold">Loading…</p>
            ) : events.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500 font-bold">No events yet.</p>
            ) : (
              <div className="mt-4 space-y-4 max-h-[680px] overflow-auto pr-1">
                {events.map((ev) => (
                  <div key={ev.id} className="p-5 rounded-2xl border border-slate-100 bg-slate-50">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-black text-slate-800 text-lg">{ev.title}</p>
                        <p className="text-xs font-bold text-slate-500">Starts: {new Date(ev.startAt).toLocaleString()}</p>
                        <p className="text-xs font-bold text-slate-500">Visibility: {ev.allowedDepartments?.length ? ev.allowedDepartments.join(", ") : "All Departments"}</p>
                      </div>
                      <div className="flex gap-2 flex-wrap justify-end">
                        <button
                          onClick={() => { setUploadingFor(ev.id); setPosterFile(null); }}
                          className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl font-black text-xs border border-indigo-100"
                        >
                          Poster
                        </button>
                        <button
                          onClick={() => editEvent(ev)}
                          className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-black text-xs border border-slate-200"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => openRegistrations(ev)}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-black text-xs shadow-sm hover:shadow-md transition-all"
                        >
                          Manage
                        </button>
                      </div>
                    </div>

                    {posterUrl(ev) ? (
                      <img alt="Poster" src={posterUrl(ev) || ""} className="mt-4 w-full rounded-2xl border border-slate-100" />
                    ) : (
                      <p className="mt-3 text-xs font-bold text-slate-500">No poster uploaded.</p>
                    )}

                    {uploadingFor === ev.id && (
                      <div className="mt-4 p-4 bg-white rounded-2xl border border-slate-200">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Poster (PNG/JPG, max 5MB)</p>
                        <input
                          ref={posterInputRef}
                          className="hidden"
                          type="file"
                          accept="image/png,image/jpeg"
                          onChange={(e) => setPosterFile(e.target.files?.[0] || null)}
                        />

                        <div className="mt-2 flex flex-col sm:flex-row gap-3 sm:items-center">
                          <button
                            type="button"
                            onClick={() => posterInputRef.current?.click()}
                            className="px-6 py-3 bg-slate-900 text-white font-black rounded-2xl text-sm hover:bg-slate-800 transition-all"
                          >
                            {posterFile ? "Change file" : "Choose file"}
                          </button>

                          <div className="flex-1 px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-700 break-all">
                            {posterFile ? posterFile.name : "No file selected"}
                          </div>

                          {posterFile ? (
                            <button
                              type="button"
                              onClick={() => {
                                setPosterFile(null);
                                if (posterInputRef.current) posterInputRef.current.value = "";
                              }}
                              className="px-5 py-3 bg-slate-100 text-slate-700 font-black rounded-2xl text-sm border border-slate-200 hover:bg-slate-200 transition-all"
                            >
                              Remove
                            </button>
                          ) : null}
                        </div>
                        <div className="mt-3 flex gap-2 justify-end">
                          <button
                            onClick={() => { setUploadingFor(null); setPosterFile(null); }}
                            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-black text-xs border border-slate-200"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => uploadPoster(ev.id)}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-black text-xs"
                          >
                            Upload
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {regsEvent && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={() => { setRegsEvent(null); setScannerActive(false); }}>
          <div className="w-full max-w-4xl bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-2xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-black text-slate-800">{regsEvent.title}</h3>
                <p className="mt-1 text-sm font-bold text-slate-500">Event Administration & Attendance Tracking</p>
              </div>
              <button className="text-slate-500 font-black text-xl" onClick={() => { setRegsEvent(null); setScannerActive(false); }}>
                ✕
              </button>
            </div>

            <div className="mt-6 flex gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
              <button
                onClick={() => { setModalTab("list"); setScannerActive(false); }}
                className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${modalTab === "list" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
              >
                Registration List ({registrations.length})
              </button>
              <button
                onClick={() => setModalTab("attendance")}
                className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${modalTab === "attendance" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
              >
                Mark Attendance
              </button>
            </div>

            {(toast || error) && (
              <div
                className={`mt-4 p-4 rounded-xl border text-sm font-bold ${error ? "bg-rose-50 text-rose-700 border-rose-100" : "bg-emerald-50 text-emerald-700 border-emerald-100"
                  }`}
              >
                {error || toast}
              </div>
            )}

            {modalTab === "list" ? (
              <div className="mt-6 flex-grow flex flex-col overflow-hidden">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-black text-slate-800 uppercase tracking-widest text-[10px]">Registered Students</h4>
                  <button
                    onClick={downloadReport}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-black text-xs shadow-md hover:bg-emerald-700"
                  >
                    📥 Download CSV Report
                  </button>
                </div>
                {loadingRegs ? (
                  <p className="text-sm font-bold text-slate-500">Loading…</p>
                ) : registrations.length === 0 ? (
                  <p className="text-sm font-bold text-slate-500">No registrations yet.</p>
                ) : (
                  <div className="flex-grow overflow-auto pr-1 space-y-3">
                    {registrations.map((r) => (
                      <div key={r.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-[10px] ${r.isPresent ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>
                              {r.isPresent ? "✓" : "•"}
                            </div>
                            <div>
                              <p className="font-black text-slate-800 text-sm truncate">{r.studentEmail}</p>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                {r.studentDepartment || "No Dept"} • {new Date(r.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => setConfirming({ id: r.studentEmail, status: !r.isPresent })}
                            className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border transition-all ${r.isPresent ? "bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100" : "bg-white text-slate-400 border-slate-100 hover:bg-slate-50"}`}
                          >
                            {r.isPresent ? "Present" : "Absent"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-6 flex-grow flex flex-col overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-black text-slate-800">Quick Scan</h4>
                      <p className="text-xs font-bold text-slate-500 mt-1">Scan student ticket or ID barcode.</p>

                      {scannerActive ? (
                        <div className="mt-4 rounded-[2rem] overflow-hidden border-2 border-indigo-600 bg-black aspect-[16/9] flex items-center justify-center">
                          <div id="qr-reader" className="w-full"></div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setScannerActive(true)}
                          className="mt-4 w-full aspect-[16/9] bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-4 hover:bg-slate-100 transition-all border-indigo-200 bg-indigo-50/30"
                        >
                          <span className="text-4xl">📷</span>
                          <span className="font-black text-indigo-600 text-sm">Start Scanner (QR/Barcode)</span>
                        </button>
                      )}

                      {scannerActive && (
                        <button
                          onClick={() => setScannerActive(false)}
                          className="mt-4 w-full py-3 bg-rose-50 text-rose-700 rounded-2xl font-black text-xs border border-rose-100"
                        >
                          Stop Scanner
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-[2rem] border border-slate-100 p-8">
                    <h4 className="font-black text-slate-800">Manual Entry</h4>
                    <p className="text-xs font-bold text-slate-500 mt-1">Enter Roll Number or Email manually.</p>

                    <div className="mt-6">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Student ID</p>
                      <input
                        value={manualRoll}
                        placeholder="e.g. 21CSR001"
                        onChange={(e) => setManualRoll(e.target.value)}
                        className="mt-2 w-full p-4 rounded-2xl bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold uppercase transition-all"
                      />
                    </div>

                    <button
                      disabled={markingAtt || !manualRoll.trim()}
                      onClick={() => setConfirming({ id: manualRoll, status: true })}
                      className="mt-6 w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-60"
                    >
                      {markingAtt ? "Processing…" : "Mark as Present"}
                    </button>

                    <div className="mt-8 pt-8 border-t border-slate-200">
                      <h5 className="font-black text-slate-400 text-[10px] uppercase tracking-widest mb-4">Tips</h5>
                      <ul className="text-xs font-bold text-slate-500 space-y-2">
                        <li className="flex gap-2"><span>•</span> <span>Scanning works for both QR codes and barcodes.</span></li>
                        <li className="flex gap-2"><span>•</span> <span>You can download the full attendance list at any time.</span></li>
                        <li className="flex gap-2"><span>•</span> <span>Status cards allow toggling present/absent state.</span></li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Confirmation Overlay */}
            {confirming && (
              <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm flex items-center justify-center p-8 rounded-[2.5rem] animate-in fade-in zoom-in-95 duration-200">
                <div className="text-center max-w-sm">
                  <div className={`w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-6 ${confirming.status ? "bg-indigo-100 text-indigo-600" : "bg-rose-100 text-rose-600"}`}>
                    {confirming.status ? "📋" : "⚠️"}
                  </div>
                  <h4 className="text-2xl font-black text-slate-800">Confirm Action</h4>
                  <p className="mt-3 text-slate-500 font-bold leading-relaxed">
                    Do you want to mark <span className="text-slate-900 font-black">{confirming.id}</span> as <span className={confirming.status ? "text-indigo-600" : "text-rose-600"}>{confirming.status ? "PRESENT" : "ABSENT"}</span>?
                  </p>

                  <div className="mt-8 grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setConfirming(null)}
                      className="py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm hover:bg-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={markingAtt}
                      onClick={() => handleMarkAttendance(confirming.id, confirming.status)}
                      className={`py-4 text-white rounded-2xl font-black text-sm shadow-lg transition-all ${confirming.status ? "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100" : "bg-rose-600 hover:bg-rose-700 shadow-rose-100"}`}
                    >
                      {markingAtt ? "..." : "Confirm"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EventManagerEventsPage;
