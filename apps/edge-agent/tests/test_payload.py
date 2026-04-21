import socket
import unittest
from unittest.mock import patch

from edge_agent.payload import _network_interfaces


class PayloadTest(unittest.TestCase):
    def test_network_interfaces_supports_linux_packet_family(self) -> None:
        af_packet = getattr(socket, "AF_PACKET", None)
        if af_packet is None:
            af_packet = type("Family", (), {"name": "AF_PACKET"})()

        fake_addrs = {
            "eth0": [
                type("Addr", (), {"family": af_packet, "address": "aa:bb:cc:dd:ee:ff"})(),
                type("Addr", (), {"family": socket.AF_INET, "address": "192.168.1.10"})(),
            ]
        }

        with patch("edge_agent.payload.psutil.net_if_addrs", return_value=fake_addrs):
            interfaces = _network_interfaces()

        self.assertEqual(len(interfaces), 1)
        self.assertEqual(interfaces[0]["name"], "eth0")
        self.assertEqual(interfaces[0]["mac"], "aa:bb:cc:dd:ee:ff")
        self.assertEqual(interfaces[0]["ips"], ["192.168.1.10"])


if __name__ == "__main__":
    unittest.main()
