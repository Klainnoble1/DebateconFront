"use client";

import { useState } from "react";
import {
  LiveKitRoom,
  useTracks,
  useLocalParticipant,
  VideoTrack,
  AudioTrack,
  useParticipants,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import type { TrackReference } from "@livekit/components-react";
import "@livekit/components-styles";
import type { Side } from "@/lib/types";

export default function DebateRoom({
  livekitUrl,
  token,
  yourSide,
  opponentSide,
  opponentName,
  audience = false,
  onDisconnected,
}: {
  livekitUrl: string;
  token: string;
  yourSide: Side | null;
  opponentSide: Side | null;
  opponentName: string;
  audience?: boolean;
  onDisconnected: () => void;
}) {
  return (
    <LiveKitRoom
      serverUrl={livekitUrl}
      token={token}
      connect
      video={!audience}
      audio={!audience}
      onDisconnected={onDisconnected}
      className="h-full"
    >
      <RoomLayout
        yourSide={yourSide}
        opponentSide={opponentSide}
        opponentName={opponentName}
        audience={audience}
      />
    </LiveKitRoom>
  );
}

function RoomLayout({
  yourSide,
  opponentSide,
  opponentName,
  audience,
}: {
  yourSide: Side | null;
  opponentSide: Side | null;
  opponentName: string;
  audience: boolean;
}) {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const participants = useParticipants();
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const cameraTracks = useTracks([Track.Source.Camera]).filter(
    (t): t is TrackReference => !!t.publication
  );
  const screenShareTracks = useTracks([Track.Source.ScreenShare]).filter(
    (t): t is TrackReference => !!t.publication
  );
  const micTracks = useTracks([Track.Source.Microphone]).filter(
    (t): t is TrackReference => !!t.publication
  );

  const localCamTrack = cameraTracks.find((t) => t.participant.isLocal);
  const remoteCamTrack = cameraTracks.find((t) => !t.participant.isLocal);
  const remoteMicTrack = micTracks.find((t) => !t.participant.isLocal);
  const activeScreenShare = screenShareTracks[0]; // either participant's share
  const remoteCamTracks = cameraTracks.filter((t) => !t.participant.isLocal);
  const remoteMicTracks = micTracks.filter((t) => !t.participant.isLocal);

  async function toggleScreenShare() {
    if (!localParticipant) return;
    try {
      if (isScreenSharing) {
        await localParticipant.setScreenShareEnabled(false);
        setIsScreenSharing(false);
      } else {
        await localParticipant.setScreenShareEnabled(true, { audio: false });
        setIsScreenSharing(true);
      }
    } catch (err) {
      console.error("Screen share toggle failed:", err);
    }
  }

  return (
    <div className="h-full flex flex-col bg-ink">
      {/* Screen share takes over the main viewport when active */}
      {activeScreenShare ? (
        <div className="flex-1 relative bg-black">
          <VideoTrack trackRef={activeScreenShare} className="w-full h-full object-contain" />
          <div className="absolute bottom-3 right-3 flex gap-2">
            {!audience && (
              <PodiumThumb
                label={localParticipant ? "You" : ""}
                side={yourSide}
                track={localCamTrack}
              />
            )}
            {remoteCamTracks.map((track) => (
              <PodiumThumb
                key={track.participant.identity}
                label={track.participant.name || opponentName}
                side={opponentSide}
                track={track}
              />
            ))}
          </div>
        </div>
      ) : audience ? (
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-px bg-line/20">
          {remoteCamTracks.length === 0 ? (
            <div className="sm:col-span-2 flex items-center justify-center bg-ink text-paper/40 font-display text-2xl italic">
              Waiting for speakers
            </div>
          ) : (
            remoteCamTracks.map((track) => (
              <Podium
                key={track.participant.identity}
                label={track.participant.name || "Speaker"}
                side={null}
                track={track}
              />
            ))
          )}
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-px bg-line/20">
          <Podium
            label="You"
            side={yourSide}
            track={localCamTrack}
            isCameraOff={!isCameraEnabled}
            isMicOff={!isMicrophoneEnabled}
          />
          <Podium
            label={opponentName}
            side={opponentSide}
            track={remoteCamTrack}
            isCameraOff={!remoteCamTrack}
            isMicOff={!remoteMicTrack}
          />
        </div>
      )}

      {/* Hidden audio renderer for remote mic */}
      {audience
        ? remoteMicTracks.map((track) => (
            <AudioTrack key={track.participant.identity} trackRef={track} />
          ))
        : remoteMicTrack && <AudioTrack trackRef={remoteMicTrack} />}

      {/* Controls */}
      {audience ? (
        <div className="flex items-center justify-center gap-3 py-4 bg-ink border-t border-paper/10">
          <span className="font-mono text-[10px] uppercase tracking-wide text-paper/50">
            Listening live | {participants.length} in room
          </span>
        </div>
      ) : (
        <Controls
          isMicOn={isMicrophoneEnabled}
          isCameraOn={isCameraEnabled}
          isScreenSharing={isScreenSharing}
          onToggleMic={() => localParticipant?.setMicrophoneEnabled(!isMicrophoneEnabled)}
          onToggleCamera={() => localParticipant?.setCameraEnabled(!isCameraEnabled)}
          onToggleScreenShare={toggleScreenShare}
          participantCount={participants.length}
        />
      )}
    </div>
  );
}

function Podium({
  label,
  side,
  track,
  isCameraOff,
  isMicOff,
}: {
  label: string;
  side: Side | null;
  track: TrackReference | undefined;
  isCameraOff?: boolean;
  isMicOff?: boolean;
}) {
  const accentClass = side === "a" ? "border-side-a" : side === "b" ? "border-side-b" : "border-line";
  const labelColorClass = side === "a" ? "text-side-a" : side === "b" ? "text-side-b" : "text-ink-soft";

  return (
    <div className={`relative bg-ink flex items-center justify-center border-t-4 ${accentClass}`}>
      {track && !isCameraOff ? (
        <VideoTrack trackRef={track} className="w-full h-full object-cover" />
      ) : (
        <div className="text-paper/40 font-display text-2xl italic">{label}</div>
      )}

      <div className="absolute top-3 left-3 flex items-center gap-2 bg-ink/70 backdrop-blur-sm px-3 py-1.5 rounded-sm">
        <span className={`font-mono text-[11px] uppercase tracking-wide ${labelColorClass}`}>
          {label}
        </span>
        {isMicOff && <MicOffIcon />}
      </div>
    </div>
  );
}

function PodiumThumb({
  label,
  side,
  track,
}: {
  label: string;
  side: Side | null;
  track: TrackReference | undefined;
}) {
  const accentClass = side === "a" ? "border-side-a" : side === "b" ? "border-side-b" : "border-line";
  return (
    <div className={`w-32 h-20 sm:w-40 sm:h-24 rounded-sm overflow-hidden border-2 ${accentClass} bg-ink`}>
      {track ? (
        <VideoTrack trackRef={track} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-paper/40 font-mono text-[10px]">
          {label}
        </div>
      )}
    </div>
  );
}

function Controls({
  isMicOn,
  isCameraOn,
  isScreenSharing,
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  participantCount,
}: {
  isMicOn: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  participantCount: number;
}) {
  return (
    <div className="flex items-center justify-center gap-3 py-4 bg-ink border-t border-paper/10">
      <ControlButton active={isMicOn} onClick={onToggleMic} label={isMicOn ? "Mute" : "Unmute"} />
      <ControlButton
        active={isCameraOn}
        onClick={onToggleCamera}
        label={isCameraOn ? "Stop video" : "Start video"}
      />
      <ControlButton
        active={isScreenSharing}
        onClick={onToggleScreenShare}
        label={isScreenSharing ? "Stop sharing" : "Share screen"}
        accent
      />
      <span className="font-mono text-[10px] text-paper/40 ml-2">
        {participantCount} in room
      </span>
    </div>
  );
}

function ControlButton({
  active,
  onClick,
  label,
  accent,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`font-mono text-xs uppercase tracking-wide px-4 py-2.5 rounded-sm border transition-colors ${
        accent && active
          ? "border-accent-gold text-accent-gold bg-accent-gold/10"
          : active
          ? "border-paper/30 text-paper"
          : "border-side-a text-side-a bg-side-a/10"
      }`}
    >
      {label}
    </button>
  );
}

function MicOffIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-side-a">
      <path d="M1 1l22 22M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23M12 19v3" strokeWidth="2" />
    </svg>
  );
}
