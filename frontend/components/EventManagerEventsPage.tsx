import React, { useEffect, useMemo, useRef, useState } from "react";
import { User } from "../types";
import { eventService, EventFormField, EventItem, EventRegistrationItem } from "../services/events";

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
  // local is from <input type="datetime-local">, e.g. 2026-02-01T18:30
  const d = new Date(local);
  return d.toISOString();
};

const getTodayString = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const EventManagerEventsPage: React.FC<Props> = ({ user }) => {
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<EventItem[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [venue, setVenue] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  const [allDepts, setAllDepts] = useState(true);
  const [allowedDepartments, setAllowedDepartments] = useState<string[]>([]);
  const [customDept, setCustomDept] = useState("");

  const [fields, setFields] = useState<EventFormField[]>([
    { key: "full_name", label: "Full Name", type: "text", required: true },
    { key: "phone", label: "Phone Number", type: "text", required: true },
  ]);

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

    if (!allDepts && allowedDepartments.length === 0) {
      setError("Select at least one allowed department (or enable All departments). ");
      return;
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
      setToast(editingEventId ? "Event updated successfully." : "Event created. Upload poster for better reach.");
      setTitle("");
      setDescription("");
      setVenue("");
      setStartAt("");
      setEndAt("");
      setAllowedDepartments([]);
      setAllDepts(false);
      setFields([]);
      setEditingEventId(null);
      refresh();
    } else {
      setError(res.message || `Failed to ${editingEventId ? 'update' : 'create'} event.`);
    }
  };

  const startEditEvent = (ev: EventItem) => {
    setEditingEventId(ev.id);
    setTitle(ev.title);
    setDescription(ev.description);
    setVenue(ev.venue || "");
    
    // Convert ISO to datetime-local format
    const startDate = new Date(ev.startAt);
    const startLocal = startDate.toISOString().slice(0, 16);
    setStartAt(startLocal);
    
    if (ev.endAt) {
      const endDate = new Date(ev.endAt);
      const endLocal = endDate.toISOString().slice(0, 16);
      setEndAt(endLocal);
    } else {
      setEndAt("");
    }
    
    if (!ev.allowedDepartments || ev.allowedDepartments.length === 0) {
      setAllDepts(true);
      setAllowedDepartments([]);
    } else {
      setAllDepts(false);
      setAllowedDepartments(ev.allowedDepartments);
    }
    
    setFields(ev.formFields || []);
    setError(null);
    setToast(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingEventId(null);
    setTitle("");
    setDescription("");
    setVenue("");
    setStartAt("");
    setEndAt("");
    setAllowedDepartments([]);
    setAllDepts(false);
    setFields([]);
    setError(null);
    setToast(null);
  };

  const uploadPoster = async (eventId: string) => {
    setToast(null);
    setError(null);
    if (!posterFile) {
      setError("Please choose a poster image (PNG/JPG)." );
      return;
    }
    
    // Check if this event already has a poster
    const event = events.find(e => e.id === eventId);
    const hasPoster = event?.poster && posterUrl(event);
    
    const res = hasPoster 
      ? await eventService.updatePoster(user, eventId, posterFile)
      : await eventService.uploadPoster(user, eventId, posterFile);
    
    if (res.success) {
      setToast(hasPoster ? "Poster updated successfully." : "Poster uploaded.");
      setPosterFile(null);
      setUploadingFor(null);
      await refresh();
      return;
    }
    setError(res.message || `${hasPoster ? 'Poster update' : 'Poster upload'} failed`);
  };

  const openRegistrations = async (ev: EventItem) => {
    setRegsEvent(ev);
    setRegistrations([]);
    setLoadingRegs(true);
    const list = await eventService.listRegistrations(user, ev.id);
    setRegistrations(list);
    setLoadingRegs(false);
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
            className={`mt-5 p-4 rounded-2xl border font-bold ${
              error ? "bg-rose-50 text-rose-700 border-rose-100" : "bg-emerald-50 text-emerald-700 border-emerald-100"
            }`}
          >
            {error || toast}
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-50 rounded-2xl border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-slate-800">{editingEventId ? "Edit Event" : "Create Event"}</h3>
              {editingEventId && (
                <button onClick={cancelEdit} className="text-xs font-black text-slate-500 hover:text-slate-700">
                  Cancel Edit
                </button>
              )}
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Title</p>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-2 w-full p-4 rounded-2xl bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                />
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Description</p>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-2 w-full min-h-[120px] p-4 rounded-2xl bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Start</p>
                  <input
                    type="datetime-local"
                    min={`${getTodayString()}T00:00`}
                    value={startAt}
                    onChange={(e) => setStartAt(e.target.value)}
                    className="mt-2 w-full p-4 rounded-2xl bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">End (optional)</p>
                  <input
                    type="datetime-local"
                    min={`${getTodayString()}T00:00`}
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
                          className={`px-3 py-2 rounded-xl border text-xs font-black ${
                            allowedDepartments.includes(d)
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
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Label</p>
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
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Key</p>
                          <input
                            value={f.key}
                            onChange={(e) => updateField(idx, { key: e.target.value })}
                            className="mt-2 w-full p-3 rounded-xl bg-white border border-slate-200 font-bold"
                          />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Type</p>
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
                className="w-full mt-2 px-6 py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg hover:bg-indigo-700"
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
                        <p className="text-xs font-bold text-slate-500">Starts: {(() => {
                          const d = new Date(ev.startAt);
                          const day = String(d.getDate()).padStart(2, '0');
                          const month = String(d.getMonth() + 1).padStart(2, '0');
                          const year = d.getFullYear();
                          const hours = String(d.getHours()).padStart(2, '0');
                          const mins = String(d.getMinutes()).padStart(2, '0');
                          return `${day}-${month}-${year} ${hours}:${mins}`;
                        })()}</p>
                        <p className="text-xs font-bold text-slate-500">Visibility: {ev.allowedDepartments?.length ? ev.allowedDepartments.join(", ") : "All Departments"}</p>
                      </div>
                      <div className="flex gap-2 flex-wrap justify-end">
                        <button
                          onClick={() => startEditEvent(ev)}
                          className="px-3 py-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg text-xs font-black border border-indigo-200 transition-all"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => { setUploadingFor(ev.id); setPosterFile(null); }}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-black text-xs"
                        >
                          Upload Poster
                        </button>
                        <button
                          onClick={() => openRegistrations(ev)}
                          className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-black text-xs border border-slate-200"
                        >
                          Registrations
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
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={() => setRegsEvent(null)}>
          <div className="w-full max-w-3xl bg-white rounded-[2rem] p-6 border border-slate-100 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-slate-800">Registrations • {regsEvent.title}</h3>
                <p className="mt-1 text-sm font-bold text-slate-500">Total: {registrations.length}</p>
              </div>
              <button className="text-slate-500 font-black" onClick={() => setRegsEvent(null)}>
                ✕
              </button>
            </div>

            {loadingRegs ? (
              <p className="mt-4 text-sm font-bold text-slate-500">Loading…</p>
            ) : registrations.length === 0 ? (
              <p className="mt-4 text-sm font-bold text-slate-500">No registrations yet.</p>
            ) : (
              <div className="mt-4 max-h-[520px] overflow-auto pr-1 space-y-2">
                {registrations.map((r) => (
                  <div key={r.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-black text-slate-800 text-sm truncate">{r.studentEmail}</p>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 bg-white px-3 py-1 rounded-full border border-slate-200">
                        {r.studentDepartment || "—"}
                      </span>
                    </div>
                    <p className="mt-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">{(() => {
                      const d = new Date(r.createdAt);
                      const day = String(d.getDate()).padStart(2, '0');
                      const month = String(d.getMonth() + 1).padStart(2, '0');
                      const year = d.getFullYear();
                      return `${day}-${month}-${year}`;
                    })()}</p>
                    {Object.keys(r.answers || {}).length > 0 && (
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                        {Object.entries(r.answers).slice(0, 12).map(([k, v]) => (
                          <div key={k} className="text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2">
                            <span className="text-slate-500">{k}:</span> {String(v)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EventManagerEventsPage;
