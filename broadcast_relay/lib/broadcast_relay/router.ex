defmodule BroadcastRelay.Router do
  use Plug.Router

  plug(Plug.Parsers,
    parsers: [:urlencoded, :multipart]
  )

  plug(Plug.Static, at: "/", from: :broadcast_relay)

  plug(:match)
  plug(:dispatch)

  post "/stream/:freq" do
    IO.puts("📥 Incoming covert broadcast on Frequency: #{freq}")
    read_and_relay(conn, freq)
  end

  defp read_and_relay(conn, freq) do
    case read_body(conn, length: 1_000_000) do
      {:ok, body, conn} ->
        relay_to_clients(body, freq)
        send_resp(conn, 200, "Done")

      {:more, body, conn} ->
        relay_to_clients(body, freq)
        read_and_relay(conn, freq)
    end
  end

  defp relay_to_clients(data, freq) do
    Phoenix.PubSub.broadcast(BroadcastRelay.PubSub, "video_stream:#{freq}", {:video_chunk, data})
  end

  match _ do
    send_resp(conn, 404, "Not Found")
  end
end
