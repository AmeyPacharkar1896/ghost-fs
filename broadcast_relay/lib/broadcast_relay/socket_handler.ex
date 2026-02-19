defmodule BroadcastRelay.SocketHandler do
  @behaviour :cowboy_websocket

  def init(request, _state) do
    IO.puts("🔌 Frontend connected to Socket!")
    {:cowboy_websocket, request, %{}}
  end

  def websocket_init(state) do
    Phoenix.PubSub.subscribe(BroadcastRelay.PubSub, "video_stream")
    IO.puts("✅ Subscribed to 'video_stream' topic.")
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
