// using System.Text;
// using System.Text.Json;
// using Microsoft.AspNetCore.SignalR;
// using MQTTnet;
// using MQTTnet.Client;

// namespace SmartLightingDigitalTwinApi;

// public class MqttDigitalTwinWorker : BackgroundService
// {
//     private readonly IHubContext<StreetLightHub> _hubContext;
//     private readonly IMqttClient _mqttClient;

//     public MqttDigitalTwinWorker(IHubContext<StreetLightHub> hubContext)
//     {
//         _hubContext = hubContext;
//         _mqttClient = new MqttFactory().CreateMqttClient();
//     }

//     protected override async Task ExecuteAsync(CancellationToken stoppingToken)
//     {
//         var options = new MqttClientOptionsBuilder()
//             .WithTcpServer("broker.hivemq.com", 1883)
//             .WithClientId($"DigitalTwin-Backend-{Guid.NewGuid()}")
//             .Build();

//         _mqttClient.ApplicationMessageReceivedAsync += async e =>
//         {
//             var payload = Encoding.UTF8.GetString(e.ApplicationMessage.PayloadSegment);
//             var telemetry = JsonSerializer.Deserialize<PoleTelemetry>(payload,
//                 new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

//             if (telemetry is null) return;

//             bool isLampFault = telemetry.Brightness > 0 && telemetry.PowerWatts == 0;
//             double savedWatts = 100.0 - telemetry.PowerWatts;

//             var twinState = new
//             {
//                 telemetry.PoleId,
//                 telemetry.AmbientLightPct,
//                 telemetry.DistanceCm,
//                 telemetry.TrafficDetected,
//                 telemetry.Brightness,
//                 telemetry.PowerWatts,
//                 telemetry.Mode,
//                 Status = isLampFault ? "FAULT_LAMP_BURNED" : "HEALTHY",
//                 SavedWatts = savedWatts,
//                 Timestamp = DateTime.UtcNow
//             };

//             await _hubContext.Clients.All.SendAsync("ReceivePoleUpdate", twinState, stoppingToken);
//         };

//         await _mqttClient.ConnectAsync(options, stoppingToken);
//         await _mqttClient.SubscribeAsync("city/street1/+/telemetry", cancellationToken: stoppingToken);
//     }

//     public async Task SendCommandAsync(string poleId, object commandPayload)
//     {
//         if (!_mqttClient.IsConnected) return;

//         var message = new MqttApplicationMessageBuilder()
//             .WithTopic($"city/street1/{poleId}/command")
//             .WithPayload(JsonSerializer.Serialize(commandPayload))
//             .Build();

//         await _mqttClient.PublishAsync(message);
//     }
// }
//===========================================================================

using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.SignalR;
using MQTTnet;
using MQTTnet.Client;
using MQTTnet.Formatter;

namespace SmartLightingDigitalTwinApi;

public class MqttDigitalTwinWorker : BackgroundService
{
    private readonly IHubContext<StreetLightHub> _hubContext;
    private readonly IMqttClient _mqttClient;

    public MqttDigitalTwinWorker(IHubContext<StreetLightHub> hubContext)
    {
        _hubContext = hubContext;
        _mqttClient = new MqttFactory().CreateMqttClient();
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var options = new MqttClientOptionsBuilder()
            .WithTcpServer("broker.hivemq.com", 1883)
            .WithClientId($"DigitalTwin-Backend-{Guid.NewGuid()}")
            .WithProtocolVersion(MqttProtocolVersion.V311)
            .WithCleanSession()
            .WithTimeout(TimeSpan.FromSeconds(10))
            .Build();

        _mqttClient.ApplicationMessageReceivedAsync += async e =>
        {
            var payload = Encoding.UTF8.GetString(e.ApplicationMessage.PayloadSegment);
            var telemetry = JsonSerializer.Deserialize<PoleTelemetry>(payload,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            if (telemetry is null) return;

            bool isLampFault = telemetry.Brightness > 0 && telemetry.PowerWatts == 0;
            double savedWatts = 100.0 - telemetry.PowerWatts;

            var twinState = new
            {
                telemetry.PoleId,
                telemetry.AmbientLightPct,
                telemetry.DistanceCm,
                telemetry.TrafficDetected,
                telemetry.Brightness,
                telemetry.PowerWatts,
                telemetry.Mode,
                Status = isLampFault ? "FAULT_LAMP_BURNED" : "HEALTHY",
                SavedWatts = savedWatts,
                Timestamp = DateTime.UtcNow
            };

            await _hubContext.Clients.All.SendAsync("ReceivePoleUpdate", twinState, stoppingToken);
        };

        // حلقة اتصال مستمرة مع إعادة المحاولة التلقائية
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if (!_mqttClient.IsConnected)
                {
                    Console.WriteLine("Connecting to MQTT Broker...");
                    await _mqttClient.ConnectAsync(options, stoppingToken);
                    await _mqttClient.SubscribeAsync("city/street1/+/telemetry", cancellationToken: stoppingToken);
                    Console.WriteLine("Connected & Subscribed to MQTT Broker successfully!");
                }

                await Task.Delay(3000, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break; // إغلاق طبيعي عند الضغط على Ctrl+C
            }
            catch (Exception ex)
            {
                Console.WriteLine($"MQTT connection warning: {ex.Message}. Retrying in 3s...");
                try { await Task.Delay(3000, stoppingToken); }
                catch (OperationCanceledException) { break; }
            }
        }
    }

    public async Task SendCommandAsync(string poleId, object commandPayload)
    {
        if (!_mqttClient.IsConnected) return;

        var message = new MqttApplicationMessageBuilder()
            .WithTopic($"city/street1/{poleId}/command")
            .WithPayload(JsonSerializer.Serialize(commandPayload))
            .Build();

        await _mqttClient.PublishAsync(message);
    }
}