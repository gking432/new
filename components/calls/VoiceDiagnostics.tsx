"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  VOICE_TRACE_EVENT, readVoiceReports, flushVoiceReports, voiceStorageAvailable,
  clearVoiceReports, setVoiceAudioRoute, voiceReportSummary, type VoiceReport,
} from "@/lib/realtime/diagnostics";

export function VoiceDiagnosticControls({ onMark }: { onMark: () => void }) {
  return <div className="flex justify-center">
    <button type="button" className="min-h-11 rounded-full border bg-background px-3 text-xs text-foreground shadow-sm"
      onClick={() => { onMark(); toast.success("Audio issue marked", { description: "Report saved in Demo Center → Voice diagnostics." }); }}>
      Mark audio issue
    </button>
  </div>;
}

export function VoiceDiagnosticsPanel() {
  const [reports, setReports] = useState<VoiceReport[]>([]);
  const [selected, setSelected] = useState("");
  const [persistent, setPersistent] = useState(true);
  useEffect(() => {
    function refresh() { setReports(readVoiceReports()); setPersistent(voiceStorageAvailable()); }
    refresh();
    // Apply retention to disk as well as the list shown to the user.
    flushVoiceReports();
    window.addEventListener(VOICE_TRACE_EVENT, refresh);
    return () => window.removeEventListener(VOICE_TRACE_EVENT, refresh);
  }, []);
  const report = reports.find((r) => r.id === selected) ?? reports[0];
  const summary = report ? voiceReportSummary(report) : null;
  function exportFile() {
    if (!report) return null;
    return new File([JSON.stringify({
      ...report, summary: voiceReportSummary(report),
      interpretation: "Speech during playback does not prove speaker echo. Correlate speech, response status/reason, buffer, playback and RTC events. Missing metrics are unavailable, not zero. Audio route is user-reported, not auto-detected. An absent endedAt means the call may be ongoing or the page closed unexpectedly.",
    }, null, 2)], `northstar-voice-${report.id}.json`, { type: "application/json" });
  }
  function download() {
    const file = exportFile();
    if (!file) return;
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
  async function share() {
    const file = exportFile();
    if (!file) return;
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: "Northstar voice diagnostics" });
      else download();
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) toast.error("Sharing unavailable. Use Download report or Copy report.");
    }
  }
  async function copy() {
    const file = exportFile();
    if (!file) return;
    try { await navigator.clipboard.writeText(await file.text()); toast.success("Diagnostic report copied"); }
    catch { toast.error("Copy unavailable. Use Download report."); }
  }
  return <Card id="voice-diagnostics" className="min-w-0 scroll-mt-20">
    <CardHeader>
      <CardTitle>Voice diagnostics</CardTitle>
      <CardDescription>Technical event timings only—no audio, transcripts, contact details, or credentials. Kept on this device for 24 hours, up to 3 calls. Nothing is uploaded automatically.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-3">
      {!persistent && <p role="status" className="text-sm text-amber-700">Browser storage is unavailable. Export before leaving this page; reports are only in memory.</p>}
      {!report ? <p className="text-sm text-muted-foreground">No recent call reports on this device. Start a call, then return here. During a call, tap “Mark audio issue” when you hear a cutoff.</p> : <>
        <label className="block text-sm">Call report
          <select className="mt-1 min-h-11 w-full min-w-0 rounded-md border bg-background px-2 text-base" value={report.id} onChange={(e) => setSelected(e.target.value)}>
            {reports.map((r) => <option key={r.id} value={r.id}>{new Date(r.startedAt).toLocaleString()} · {r.persona === "customer" ? "AI homeowner" : "AI interviewer"}</option>)}
          </select>
        </label>
        <label className="block text-sm">How were you listening? (your report)
          <select id="voice-audio-route" className="mt-1 min-h-11 w-full rounded-md border bg-background px-2 text-base" value={report.audioRoute} onChange={(e) => setVoiceAudioRoute(report.id, e.target.value as VoiceReport["audioRoute"])}>
            <option value="unknown">Not specified</option><option value="speaker">Phone speaker</option>
            <option value="headphones">Headphones / Bluetooth</option><option value="earpiece">Phone earpiece</option>
          </select>
        </label>
        <p className="text-sm" aria-live="polite">{summary?.cancelled} cancelled responses · {summary?.speechDuringPlayback} speech starts during AI playback · {summary?.marked} marked issues</p>
        <p className="text-xs text-muted-foreground">These are observations, not a diagnosis. Speech during playback alone does not prove echo. {report.droppedEvents > 0 && `${report.droppedEvents} oldest events were dropped at the size limit.`}</p>
        <div className="flex flex-wrap gap-2">
          <Button className="min-h-11" onClick={() => void share()}>Share report</Button>
          <Button className="min-h-11" variant="outline" onClick={download}>Download report</Button>
          <Button className="min-h-11" variant="outline" onClick={() => void copy()}>Copy report</Button>
        </div>
        <Button className="min-h-11" variant="ghost" onClick={clearVoiceReports}>Clear saved reports</Button>
      </>}
    </CardContent>
  </Card>;
}
