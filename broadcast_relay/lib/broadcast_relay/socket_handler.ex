defmodule BroadcastRelay.SocketHandler do
  @behaviour :cowboy_websocket

  def init(request, _state) do
    query = URI.decode_query(request.qs)
    freq = Map.get(query, "freq", "unknown")

    IO.puts("🔌 [CLIENT CONNECTED] Agent tuning hardware to Frequency: #{freq}")
    {:cowboy_websocket, request, %{freq: freq}}
  end

  def websocket_init(state) do
    Phoenix.PubSub.subscribe(BroadcastRelay.PubSub, "video_stream:#{state.freq}")
    IO.puts("✅ [SIGNAL LOCKED] Hardware locked to 'video_stream:#{state.freq}'")
    {:ok, state}
  end

  # ==========================================
  # HOT PATH: Keep this clean for performance
  # (Removed the IO.puts to prevent BEAM choking at 25fps)
  # ==========================================
  def websocket_info({:video_chunk, data}, state) do
    {:reply, {:binary, data}, state}
  end

  # ==========================================
  # KILL SWITCH: Triggered by the Router
  # ==========================================
  def websocket_info(:burn_frequency, state) do
    IO.puts("🧨 [SCORCHED EARTH] Severing client connection on #{state.freq}.")
    # Sending :close forcefully drops the WebSocket connection instantly
    {:reply, :close, state}
  end

  def websocket_info(info, state) do
    IO.inspect(info, label: "⚠️ Unknown message received")
    {:ok, state}
  end

  def websocket_handle(_frame, state), do: {:ok, state}

  def terminate(reason, _req, state) do
    IO.puts(
      "❌ [SOCKET CLOSED] Frequency #{state.freq} connection terminated. Reason: #{inspect(reason)}"
    )

    :ok
  end
end
