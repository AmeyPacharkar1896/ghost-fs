defmodule BroadcastRelay.SocketHandler do
  @behaviour :cowboy_websocket

  def init(request, _state) do
    query = URI.decode_query(request.qs)
    freq = Map.get(query, "freq", "unknown")

    IO.puts("🔌 Agent tuning hardware to Frequency: #{freq}")
    {:cowboy_websocket, request, %{freq: freq}}
  end

  def websocket_init(state) do
    Phoenix.PubSub.subscribe(BroadcastRelay.PubSub, "video_stream:#{state.freq}")
    IO.puts("✅ Hardware locked to 'video_stream:#{state.freq}'")
    {:ok, state}
  end

  def websocket_info({:video_chunk, data}, state) do
    IO.puts("📦 Socket received #{byte_size(data)} bytes! Pushing to browser...")
    {:reply, {:binary, data}, state}
  end

  def websocket_info(info, state) do
    IO.inspect(info, label: "⚠️ Unknown message received")
    {:ok, state}
  end

  def websocket_handle(_frame, state), do: {:ok, state}

  def terminate(reason, _req, _state) do
    IO.puts("❌ Socket closed! Reason: #{inspect(reason)}")
    :ok
  end
end
