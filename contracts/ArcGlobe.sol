// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ArcGlobe
/// @notice Opt-in public registry of coarse globe pins, with at most one pin per wallet.
/// @dev Coordinates are degrees multiplied by ten. All stored information is public.
///      This registry does not verify USDC ownership or restrict use to a particular chain.
contract ArcGlobe {
    /// @notice A wallet's coarse location and optional city label.
    struct Pin {
        address user;
        int16 latDeci;
        int16 lonDeci;
        uint64 updatedAt;
        string city;
    }

    /// @notice Latitude must be between -900 and 900, inclusive.
    error InvalidLatitude();
    /// @notice Longitude must be between -1800 and 1800, inclusive.
    error InvalidLongitude();
    /// @notice The city label must not exceed 32 bytes.
    error CityTooLong();
    /// @notice The caller has no pin to remove.
    error NoPin();

    /// @notice Emitted when a wallet creates or updates its pin.
    event PinSet(address indexed user, int16 latDeci, int16 lonDeci, string city);
    /// @notice Emitted when a wallet removes its pin.
    event PinRemoved(address indexed user);

    mapping(address => Pin) private _pins;
    address[] private _pinnedUsers;
    // One-based indices: zero denotes an unregistered wallet.
    mapping(address => uint256) private _indexPlusOne;

    /// @notice Create or update the caller's own coarse location pin.
    /// @param latDeci Latitude in tenths of a degree, from -900 through 900.
    /// @param lonDeci Longitude in tenths of a degree, from -1800 through 1800.
    /// @param city Public city label of at most 32 bytes; may be empty.
    function setPin(int16 latDeci, int16 lonDeci, string calldata city) external {
        if (latDeci < -900 || latDeci > 900) revert InvalidLatitude();
        if (lonDeci < -1800 || lonDeci > 1800) revert InvalidLongitude();
        if (bytes(city).length > 32) revert CityTooLong();

        if (_indexPlusOne[msg.sender] == 0) {
            _pinnedUsers.push(msg.sender);
            _indexPlusOne[msg.sender] = _pinnedUsers.length;
        }

        _pins[msg.sender] = Pin({
            user: msg.sender,
            latDeci: latDeci,
            lonDeci: lonDeci,
            updatedAt: uint64(block.timestamp),
            city: city
        });

        emit PinSet(msg.sender, latDeci, lonDeci, city);
    }

    /// @notice Remove the caller's own pin in constant time.
    /// @dev Reverts with NoPin if absent. Removal can reorder the enumeration.
    function removePin() external {
        uint256 indexPlusOne = _indexPlusOne[msg.sender];
        if (indexPlusOne == 0) revert NoPin();

        uint256 index = indexPlusOne - 1;
        uint256 lastIndex = _pinnedUsers.length - 1;
        if (index != lastIndex) {
            address movedUser = _pinnedUsers[lastIndex];
            _pinnedUsers[index] = movedUser;
            _indexPlusOne[movedUser] = indexPlusOne;
        }
        _pinnedUsers.pop();
        delete _indexPlusOne[msg.sender];
        delete _pins[msg.sender];

        emit PinRemoved(msg.sender);
    }

    /// @notice Return the number of currently registered pins.
    /// @return The current pin count.
    function totalPins() external view returns (uint256) {
        return _pinnedUsers.length;
    }

    /// @notice Read a wallet's pin.
    /// @param user Wallet to look up.
    /// @return The stored pin, or an entirely zero-valued struct if absent.
    function pinOf(address user) external view returns (Pin memory) {
        return _pins[user];
    }

    /// @notice Check whether a wallet currently has a pin.
    /// @param user Wallet to look up.
    /// @return Whether the wallet has a pin.
    function hasPin(address user) external view returns (bool) {
        return _indexPlusOne[user] != 0;
    }

    /// @notice Read a page of pins, capped at 200 entries.
    /// @dev Ordering is not stable across removals. Use a consistent block for pagination.
    /// @param offset Zero-based starting index in the current enumeration.
    /// @param limit Requested number of entries; clamped to 200 and the remaining count.
    /// @return page An empty array if offset is out of range or limit is zero.
    function getPins(uint256 offset, uint256 limit) external view returns (Pin[] memory page) {
        uint256 count = _pinnedUsers.length;
        if (offset >= count) return new Pin[](0);

        if (limit > 200) limit = 200;
        uint256 remaining = count - offset;
        if (limit > remaining) limit = remaining;

        page = new Pin[](limit);
        for (uint256 i = 0; i < limit; ++i) {
            page[i] = _pins[_pinnedUsers[offset + i]];
        }
    }
}
