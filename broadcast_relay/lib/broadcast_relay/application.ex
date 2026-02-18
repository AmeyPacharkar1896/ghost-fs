defmodule BroadcastRelay.Application do
  use Application

  @impl true
  def start(_type, _args) do
    children = [
      {Phoenix.PubSub, name: BroadcastRelay.PubSub},
      {Plug.Cowboy,
       scheme: :http,
       plug: BroadcastRelay.Router,
       options: [
         port: 4000,
         dispatch: [
           {:_,
            [
              {"/socket", BroadcastRelay.SocketHandler, []},
              {:_, Plug.Cowboy.Handler, {BroadcastRelay.Router, []}}
            ]}
         ]
       ]}
    ]

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: BroadcastRelay.Supervisor]
    Supervisor.start_link(children, opts)
  end
end
