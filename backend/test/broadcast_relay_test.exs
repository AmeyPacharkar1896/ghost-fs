defmodule BroadcastRelayTest do
  use ExUnit.Case
  doctest BroadcastRelay

  test "greets the world" do
    assert BroadcastRelay.hello() == :world
  end
end
