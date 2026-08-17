// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface Vm {
    function prank(address sender) external;
    function deal(address who, uint256 newBalance) external;
    function expectRevert() external;
    function expectRevert(bytes4 selector) external;
}

abstract contract TestBase {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function assertTrue(bool value) internal pure { require(value, "assertTrue failed"); }
    function assertFalse(bool value) internal pure { require(!value, "assertFalse failed"); }
    function assertEq(uint256 left, uint256 right) internal pure { require(left == right, "uint values differ"); }
    function assertEq(address left, address right) internal pure { require(left == right, "address values differ"); }
}
