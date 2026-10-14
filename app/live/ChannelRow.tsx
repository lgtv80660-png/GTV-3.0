"use client";
import { memo } from "react";
import { Radio } from "lucide-react";
import { channelLogoUrl } from "@/lib/channel-logo-url";
import type { Channel } from "./live-types";

export const ChannelRow = memo(function ChannelRow({ channel, active, onSelect }: {
  channel: Channel;
  active: boolean;
  onSelect: (channel: Channel) => void;
}) {
  return (
    <button type="button" className={`live-channel${active ? " is-active" : ""}`} aria-pressed={active} onClick={() => onSelect(channel)}>
      <span className="live-channel-logo">
        <img src={channelLogoUrl(channel.name, channel.stream_icon)} alt="" loading="lazy" decoding="async" draggable={false} />
      </span>
      <span className="live-channel-copy">
        <strong>{channel.name}</strong>
        <small>{active ? "À l’écran" : `Chaîne ${channel.num || channel.stream_id}`}</small>
      </span>
      {active && <Radio size={16} aria-hidden="true" />}
    </button>
  );
});
