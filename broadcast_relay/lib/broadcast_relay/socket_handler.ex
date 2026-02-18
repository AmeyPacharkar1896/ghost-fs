defmodule BroadcastRelay.SocketHandler do
  @behaviour :cowboy_websocket

  def init(request, _state) do
    {:cowboy_websocket, request, %{}}
  end

  def websocket_init(state) do
    Phoenix.PubSub.subscribe(BroadcastRelay.PubSub, "video_stream")
    {:ok, state}
  end

  def websocket_info({:video_chunk, data}, state) do
    {:reply, {:binary, data}, state}
  end

  def websocket_info(_info, state) do
    {:ok, state}
  end

  def websocket_handle(_frame, state), do: {:ok, state}
  def terminate(_reason, _req, _state), do: :ok
end
