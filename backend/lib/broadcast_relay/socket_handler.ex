defmodule BroadcastRelay.SocketHandler do
  @behaviour :cowboy_websocket

  def init(request, _state) do
    query = URI.decode_query(request.qs)
    freq = Map.get(query, "freq", "unknown")
    role = Map.get(query, "role", "receiver")

    IO.puts("🔌 [CLIENT CONNECTED] Role: #{role} | Frequency: #{freq}")
    {:cowboy_websocket, request, %{freq: freq, role: role}}
  end

  def websocket_init(state) do
    if state.role == "receiver" do
      Phoenix.PubSub.subscribe(BroadcastRelay.PubSub, "video_stream:#{state.freq}")
      IO.puts("✅ [SIGNAL LOCKED] Receiver locked to 'video_stream:#{state.freq}'")
    else
      IO.puts("📡 [TRANSMITTER READY] Sender ready on 'video_stream:#{state.freq}'")
    end
    {:ok, state}
  end

  # ==========================================
  # INCOMING FROM SENDER (Web Browser Streaming)
  # ==========================================
  def websocket_handle({:binary, frame}, state) do
    if state.role == "sender" do
      Phoenix.PubSub.broadcast(BroadcastRelay.PubSub, "video_stream:#{state.freq}", {:video_chunk, frame})
    end
    {:ok, state}
  end

  def websocket_handle(_frame, state), do: {:ok, state}

  # ==========================================
  # OUTGOING TO RECEIVER
  # ==========================================
  def websocket_info({:video_chunk, data}, state) do
    if state.role == "receiver" do
      {:reply, {:binary, data}, state}
    else
      {:ok, state}
    end
  end

  # ==========================================
  # KILL SWITCH
  # ==========================================
  def websocket_info(:burn_frequency, state) do
    IO.puts("🧨 [SCORCHED EARTH] Severing connection on #{state.freq} for #{state.role}.")
    {:reply, :close, state}
  end

  def websocket_info(info, state) do
    IO.inspect(info, label: "⚠️ Unknown message received")
    {:ok, state}
  end

  def terminate(reason, _req, state) do
    if state.role == "sender" do
      IO.puts("🔥 [BURN PROTOCOL] Sender disconnected. Scorching frequency: #{state.freq}")
      Phoenix.PubSub.broadcast(BroadcastRelay.PubSub, "video_stream:#{state.freq}", :burn_frequency)
    end
    IO.puts("❌ [SOCKET CLOSED] #{state.role} on #{state.freq} terminated. Reason: #{inspect(reason)}")
    :ok
  end
end
