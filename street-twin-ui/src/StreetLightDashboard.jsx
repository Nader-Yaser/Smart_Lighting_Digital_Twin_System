import React, { useEffect, useState } from "react";
import * as signalR from "@microsoft/signalr";
import {
    Lightbulb,
    AlertTriangle,
    Zap,
    Leaf,
    Car,
    Sun,
    Sliders,
    Wifi,
    WifiOff,
    Flame,
} from "lucide-react";

const BACKEND_URL = " https://localhost:7203";

const INITIAL_POLES = {
    pole01: {
        poleId: "pole01",
        ambientLightPct: 20,
        distanceCm: 350,
        trafficDetected: false,
        brightness: 25,
        powerWatts: 25,
        mode: "AUTO",
        status: "HEALTHY",
        savedWatts: 75,
        isLive: false,
    },
    pole02: {
        poleId: "pole02",
        ambientLightPct: 20,
        distanceCm: 400,
        trafficDetected: false,
        brightness: 25,
        powerWatts: 25,
        mode: "AUTO",
        status: "HEALTHY",
        savedWatts: 75,
        isLive: false,
    },
    pole03: {
        poleId: "pole03",
        ambientLightPct: 20,
        distanceCm: 400,
        trafficDetected: false,
        brightness: 25,
        powerWatts: 25,
        mode: "AUTO",
        status: "HEALTHY",
        savedWatts: 75,
        isLive: false,
    },
};

export default function StreetLightDashboard() {
    const [poles, setPoles] = useState(INITIAL_POLES);
    const [selectedPoleId, setSelectedPoleId] = useState("pole01");
    const [isConnected, setIsConnected] = useState(false);
    const [faultLogs, setFaultLogs] = useState([]);

    // حالة لوحة التحكم اليدوي للعمود المحدد
    const [controlMode, setControlMode] = useState("AUTO");
    const [manualBrightness, setManualBrightness] = useState(80);
    const [simulateFault, setSimulateFault] = useState(false);

    // 1. الاتصال اللحظي بـ SignalR Hub
    useEffect(() => {
        const connection = new signalR.HubConnectionBuilder()
            .withUrl(`${BACKEND_URL}/hubs/streetlight`)
            .withAutomaticReconnect()
            .build();

        connection.on("ReceivePoleUpdate", (data) => {
            const id = data.poleId;
            setPoles((prev) => ({
                ...prev,
                [id]: {
                    ...prev[id],
                    ...data,
                    isLive: true,
                },
            }));

            // تسجيل تنبيه فوري في حال اكتشاف لمبة محترقة
            if (data.status === "FAULT_LAMP_BURNED") {
                setFaultLogs((prev) => {
                    const alreadyLogged = prev.some(
                        (log) => log.poleId === id && log.active
                    );
                    if (alreadyLogged) return prev;
                    return [
                        {
                            id: Date.now(),
                            poleId: id,
                            message: `عطل حرج في العمود (${id}): أمر الإضاءة ${data.brightness}% لكن استهلاك التيار 0W (احتمال احتراق الكشاف).`,
                            time: new Date().toLocaleTimeString("ar-EG"),
                            active: true,
                        },
                        ...prev,
                    ];
                });
            } else {
                // إغلاق التنبيه تلقائياً عند إصلاح العطل
                setFaultLogs((prev) =>
                    prev.map((log) =>
                        log.poleId === id ? { ...log, active: false } : log
                    )
                );
            }
        });

        connection
            .start()
            .then(() => setIsConnected(true))
            .catch((err) => console.error("SignalR Connection Error:", err));

        connection.onreconnected(() => setIsConnected(true));
        connection.onclose(() => setIsConnected(false));

        return () => {
            connection.stop();
        };
    }, []);

    // 2. إرسال أمر عكسي من React إلى الـ Backend ثم إلى Wokwi
    const sendPoleCommand = async (poleId, mode, brightness, faultFlag) => {
        try {
            await fetch(`${BACKEND_URL}/api/poles/${poleId}/command`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    mode,
                    brightness: Number(brightness),
                    simulateFault: faultFlag,
                }),
            });
        } catch (error) {
            console.error("Failed to send command:", error);
        }
    };

    // حساب الإحصائيات الإجمالية للشارع
    const poleList = Object.values(poles);
    const totalPowerWatts = poleList.reduce((sum, p) => sum + p.powerWatts, 0);
    const totalSavedWatts = poleList.reduce((sum, p) => sum + p.savedWatts, 0);
    const activeFaultsCount = poleList.filter(
        (p) => p.status === "FAULT_LAMP_BURNED"
    ).length;
    const selectedPole = poles[selectedPoleId];

    return (
        <div
            dir="rtl"
            className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans"
        >
            {/* الشريط العلوي */}
            <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
                        <Lightbulb className="w-7 h-7" />
                        التوأم الرقمي لإنارة الشوارع الذكية (Smart Street Lighting Twin)
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        مراقبة لحظية ثنائية الاتجاه عبر MQTT & SignalR — قطاع شارع 1
                    </p>
                </div>

                <div
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${isConnected
                        ? "bg-emerald-950 text-emerald-400 border border-emerald-700"
                        : "bg-rose-950 text-rose-400 border border-rose-700"
                        }`}
                >
                    {isConnected ? (
                        <>
                            <Wifi className="w-4 h-4 animate-pulse" /> متصل بالسيرفر (Live)
                        </>
                    ) : (
                        <>
                            <WifiOff className="w-4 h-4" /> جاري الاتصال بـ SignalR...
                        </>
                    )}
                </div>
            </header>

            {/* بطاقات المؤشرات الرئيسية (KPIs) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center justify-between text-slate-400 text-sm">
                        <span>الاستهلاك اللحظي الكلي</span>
                        <Zap className="w-5 h-5 text-amber-400" />
                    </div>
                    <p className="text-3xl font-bold mt-2">{totalPowerWatts.toFixed(1)} W</p>
                    <span className="text-xs text-slate-500">
                        من أصل {poleList.length * 100} W كحد أقصى
                    </span>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center justify-between text-slate-400 text-sm">
                        <span>الطاقة الموفرة حالياً</span>
                        <Leaf className="w-5 h-5 text-emerald-400" />
                    </div>
                    <p className="text-3xl font-bold text-emerald-400 mt-2">
                        {totalSavedWatts.toFixed(1)} W
                    </p>
                    <span className="text-xs text-slate-500">
                        نسبة التوفير:{" "}
                        {Math.round((totalSavedWatts / (poleList.length * 100)) * 100)}%
                    </span>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center justify-between text-slate-400 text-sm">
                        <span>الأعطال المكتشفة</span>
                        <AlertTriangle
                            className={`w-5 h-5 ${activeFaultsCount > 0 ? "text-rose-500" : "text-slate-500"
                                }`}
                        />
                    </div>
                    <p
                        className={`text-3xl font-bold mt-2 ${activeFaultsCount > 0 ? "text-rose-500" : "text-slate-100"
                            }`}
                    >
                        {activeFaultsCount}
                    </p>
                    <span className="text-xs text-slate-500">
                        تحليل تلقائي للتيار مقابل الإضاءة
                    </span>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center justify-between text-slate-400 text-sm">
                        <span>الإضاءة المحيطة (LDR)</span>
                        <Sun className="w-5 h-5 text-sky-400" />
                    </div>
                    <p className="text-3xl font-bold mt-2">
                        {selectedPole.ambientLightPct}%
                    </p>
                    <span className="text-xs text-slate-500">
                        {selectedPole.ambientLightPct > 50 ? "وضع النهار" : "وضع الليل"}
                    </span>
                </div>
            </div>

            {/* القسم الرئيسي: التمثيل البصري للشارع + لوحة التحكم */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 1. المحاكاة البصرية لأعمدة الشارع (Digital Twin Street View) */}
                <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <h2 className="text-lg font-semibold mb-4">
                        التمثيل الافتراضي للشارع (اضغط على العمود للتحكم)
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {poleList.map((pole) => {
                            const isFault = pole.status === "FAULT_LAMP_BURNED";
                            const isSelected = pole.poleId === selectedPoleId;
                            const glowOpacity = isFault ? 0 : pole.brightness / 100;

                            return (
                                <div
                                    key={pole.poleId}
                                    onClick={() => setSelectedPoleId(pole.poleId)}
                                    className={`cursor-pointer rounded-xl p-4 border transition-all relative overflow-hidden ${isFault
                                        ? "bg-rose-950/30 border-rose-600"
                                        : isSelected
                                            ? "bg-slate-800/90 border-amber-400"
                                            : "bg-slate-950 border-slate-800 hover:border-slate-700"
                                        }`}
                                >
                                    {/* هالة الضوء التفاعلية */}
                                    <div
                                        className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-amber-400/40 to-transparent pointer-events-none transition-opacity duration-500"
                                        style={{ opacity: glowOpacity }}
                                    />

                                    <div className="flex items-center justify-between relative z-10">
                                        <span className="font-bold text-lg">{pole.poleId}</span>
                                        <span
                                            className={`text-xs px-2 py-0.5 rounded-full ${pole.isLive
                                                ? "bg-emerald-500/20 text-emerald-300"
                                                : "bg-slate-800 text-slate-400"
                                                }`}
                                        >
                                            {pole.isLive ? "Wokwi Live" : "Standby"}
                                        </span>
                                    </div>

                                    {/* أيقونة الكشاف وحالته */}
                                    <div className="my-6 flex flex-col items-center relative z-10">
                                        <div
                                            className={`w-16 h-16 rounded-full flex items-center justify-center border-2 transition-all ${isFault
                                                ? "bg-rose-900/50 border-rose-500 text-rose-400 animate-bounce"
                                                : pole.brightness > 0
                                                    ? "bg-amber-400/20 border-amber-400 text-amber-300"
                                                    : "bg-slate-900 border-slate-700 text-slate-600"
                                                }`}
                                        >
                                            {isFault ? (
                                                <AlertTriangle className="w-8 h-8" />
                                            ) : (
                                                <Lightbulb className="w-8 h-8" />
                                            )}
                                        </div>

                                        <span className="mt-3 text-2xl font-bold">
                                            {isFault ? "عطل!" : `${pole.brightness}%`}
                                        </span>
                                        <span className="text-xs text-slate-400">
                                            القدرة: {pole.powerWatts} W | الوضع: {pole.mode}
                                        </span>
                                    </div>

                                    {/* مؤشر حركة المرور */}
                                    <div
                                        className={`flex items-center justify-center gap-2 text-xs py-1.5 rounded-lg ${pole.trafficDetected
                                            ? "bg-sky-500/20 text-sky-300 border border-sky-700/50"
                                            : "bg-slate-900 text-slate-500"
                                            }`}
                                    >
                                        <Car className="w-4 h-4" />
                                        {pole.trafficDetected
                                            ? `مرور مركبة (${pole.distanceCm} cm)`
                                            : "الشارع هادئ"}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* 2. لوحة التحكم العكسي في العمود المحدد */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col justify-between">
                    <div>
                        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                            <Sliders className="w-5 h-5 text-amber-400" />
                            التحكم في العمود ({selectedPoleId})
                        </h2>

                        {/* اختيار وضع التشغيل */}
                        <label className="block text-sm text-slate-400 mb-2">
                            نظام التشغيل:
                        </label>
                        <div className="grid grid-cols-2 gap-2 mb-5">
                            <button
                                onClick={() => {
                                    setControlMode("AUTO");
                                    sendPoleCommand(
                                        selectedPoleId,
                                        "AUTO",
                                        manualBrightness,
                                        simulateFault
                                    );
                                }}
                                className={`py-2 rounded-lg text-sm font-medium border ${controlMode === "AUTO"
                                    ? "bg-amber-500 text-slate-950 border-amber-400"
                                    : "bg-slate-950 text-slate-300 border-slate-800"
                                    }`}
                            >
                                تلقائي (AUTO)
                            </button>
                            <button
                                onClick={() => {
                                    setControlMode("MANUAL");
                                    sendPoleCommand(
                                        selectedPoleId,
                                        "MANUAL",
                                        manualBrightness,
                                        simulateFault
                                    );
                                }}
                                className={`py-2 rounded-lg text-sm font-medium border ${controlMode === "MANUAL"
                                    ? "bg-amber-500 text-slate-950 border-amber-400"
                                    : "bg-slate-950 text-slate-300 border-slate-800"
                                    }`}
                            >
                                يدوي (MANUAL)
                            </button>
                        </div>

                        {/* شريط التحكم في شدة الإضاءة */}
                        <div className="mb-6">
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-slate-400">شدة الإضاءة اليدوية:</span>
                                <span className="font-bold text-amber-400">
                                    {manualBrightness}%
                                </span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={manualBrightness}
                                disabled={controlMode !== "MANUAL"}
                                onChange={(e) => setManualBrightness(e.target.value)}
                                onMouseUp={() =>
                                    sendPoleCommand(
                                        selectedPoleId,
                                        "MANUAL",
                                        manualBrightness,
                                        simulateFault
                                    )
                                }
                                className="w-full accent-amber-400 cursor-pointer disabled:opacity-40"
                            />
                        </div>
                    </div>

                    {/* زر محاكاة الأعطال أثناء المناقشة */}
                    <div className="border-t border-slate-800 pt-4">
                        <p className="text-xs text-slate-400 mb-2">
                            اختبار الذكاء الاصطناعي لاكتشاف الأعطال (Fault Injection):
                        </p>
                        <button
                            onClick={() => {
                                const nextFaultState = !simulateFault;
                                setSimulateFault(nextFaultState);
                                sendPoleCommand(
                                    selectedPoleId,
                                    controlMode,
                                    manualBrightness,
                                    nextFaultState
                                );
                            }}
                            className={`w-full py-2.5 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors ${simulateFault
                                ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                                : "bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-700"
                                }`}
                        >
                            <Flame className="w-4 h-4" />
                            {simulateFault
                                ? "إصلاح الكشاف وإلغاء العطل"
                                : "محاكاة احتراق اللمبة (Simulate Fault)"}
                        </button>
                    </div>
                </div>
            </div>

            {/* سجل تنبيهات الأعطال الحية */}
            <div className="mt-6 bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h3 className="text-md font-semibold text-rose-400 flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-5 h-5" />
                    سجل تنبيهات الصيانة والأعطال (Automated Fault Alerts)
                </h3>
                {faultLogs.length === 0 ? (
                    <p className="text-sm text-slate-500">
                        جميع الأعمدة تعمل بكفاءة — لا توجد أعطال مسجلة حالياً.
                    </p>
                ) : (
                    <div className="space-y-2">
                        {faultLogs.map((log) => (
                            <div
                                key={log.id}
                                className={`p-3 rounded-lg border text-sm flex items-center justify-between ${log.active
                                    ? "bg-rose-950/40 border-rose-700 text-rose-200"
                                    : "bg-slate-950 border-slate-800 text-slate-400 line-through"
                                    }`}
                            >
                                <span>{log.message}</span>
                                <span className="text-xs opacity-75">{log.time}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}