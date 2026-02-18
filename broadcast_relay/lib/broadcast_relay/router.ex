defmodule BroadcastRelay.Router do
  use Plug.Router

  plug(Plug.Parsers,
    parsers: [:urlencoded, :multipart]
  )

  plug(:match)
  plug(:dispatch)

  post "/stream" do
    IO.puts("📥 Incoming stream request detected!")
    read_and_relay(conn)
  end

  defp read_and_relay(conn) do
    case read_body(conn, length: 1_000_000) do
      {:ok, body, conn} ->
        relay_to_clients(body)
        send_resp(conn, 200, "Done")

      {:more, body, conn} ->
        relay_to_clients(body)
        read_and_relay(conn)
    end
  end

  defp relay_to_clients(data) do
    IO.puts("🚀 Relaying chunk: #{byte_size(data)} bytes")
  end

  match _ do
    send_resp(conn, 404, "Not Found")
  end
end
