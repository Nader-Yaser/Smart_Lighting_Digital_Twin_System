namespace SmartLightingDigitalTwinApi;

public record PoleTelemetry(
    string PoleId,
    int AmbientLightPct,
    double DistanceCm,
    bool TrafficDetected,
    int Brightness,
    double PowerWatts,
    string Mode
);

public record PoleCommandRequest(
    string Mode,
    int Brightness,
    bool SimulateFault
);