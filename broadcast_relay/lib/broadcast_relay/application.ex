defmodule BroadcastRelay.Application do
  use Application

  @impl true
  def start(_type, _args) do
    children = [
      # Start the Cowboy server on Port 4000
      {Plug.Cowboy, scheme: :http, plug: BroadcastRelay.Router, options: [port: 4000]}
    ]

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: BroadcastRelay.Supervisor]
    Supervisor.start_link(children, opts)
  end
end
