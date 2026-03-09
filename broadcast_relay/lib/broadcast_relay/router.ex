defmodule BroadcastRelay.Router do
  use Plug.Router

  plug(Plug.Parsers, parsers: [:urlencoded, :multipart])
  plug(Plug.Static, at: "/", from: :broadcast_relay)
  plug(:match)
  plug(:dispatch)

  post "/stream/:freq" do
    IO.puts("📥 [ENCODER LOCKED] Incoming covert broadcast on Frequency: #{freq}")
    read_and_relay(conn, freq)
  end

  defp read_and_relay(conn, freq) do
    try do
      case read_body(conn, length: 1_000_000) do
        {:ok, body, conn} ->
          if byte_size(body) > 0, do: relay_to_clients(body, freq)
          trigger_burn(freq, "Stream gracefully ended")
          send_resp(conn, 200, "Done")

        {:more, body, conn} ->
          relay_to_clients(body, freq)
          read_and_relay(conn, freq)

        {:error, reason} ->
          trigger_burn(freq, reason)
          conn
      end
    rescue
      # If the TCP connection is violently severed by Rust, we catch it here
      e ->
        trigger_burn(freq, inspect(e))
        conn
    end
  end

  defp relay_to_clients(data, freq) do
    Phoenix.PubSub.broadcast(BroadcastRelay.PubSub, "video_stream:#{freq}", {:video_chunk, data})
  end

  defp trigger_burn(freq, reason) do
    IO.puts("🔥 [BURN PROTOCOL] Connection lost (#{reason}). Scorching frequency: #{freq}")
    Phoenix.PubSub.broadcast(BroadcastRelay.PubSub, "video_stream:#{freq}", :burn_frequency)
  end

  match _ do
    send_resp(conn, 404, "Not Found")
  end
end
