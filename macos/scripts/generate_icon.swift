import AppKit
import CoreGraphics
import Foundation

let outDir = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "./AppIcon.iconset"
try FileManager.default.createDirectory(atPath: outDir, withIntermediateDirectories: true)

func renderIcon(size: Int) -> Data {
    let s = CGFloat(size)
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    let ctx = CGContext(
        data: nil,
        width: size,
        height: size,
        bitsPerComponent: 8,
        bytesPerRow: 0,
        space: colorSpace,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    )!

    // Rounded squircle background
    let inset = s * 0.04
    let rect = CGRect(x: inset, y: inset, width: s - inset * 2, height: s - inset * 2)
    let radius = s * 0.225
    let path = CGPath(roundedRect: rect, cornerWidth: radius, cornerHeight: radius, transform: nil)
    ctx.addPath(path)
    ctx.clip()

    // Deep obsidian -> midnight indigo gradient
    let bgColors = [
        CGColor(red: 0.05, green: 0.07, blue: 0.12, alpha: 1.0),
        CGColor(red: 0.10, green: 0.14, blue: 0.25, alpha: 1.0)
    ] as CFArray
    let grad = CGGradient(colorsSpace: colorSpace, colors: bgColors, locations: [0.0, 1.0])!
    ctx.drawLinearGradient(grad, start: CGPoint(x: 0, y: s), end: CGPoint(x: s, y: 0), options: [])

    // Subtle glowing border
    ctx.addPath(path)
    ctx.setStrokeColor(CGColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 0.55))
    ctx.setLineWidth(s * 0.018)
    ctx.strokePath()

    // Prism / X-Ray lens dissecting a speech/message beam into 4 logic & motive rays
    // Incoming white "surface message" beam on left
    ctx.setLineCap(.round)
    ctx.setStrokeColor(CGColor(red: 0.90, green: 0.94, blue: 0.99, alpha: 0.92))
    ctx.setLineWidth(s * 0.045)
    ctx.move(to: CGPoint(x: s * 0.14, y: s * 0.50))
    ctx.addLine(to: CGPoint(x: s * 0.42, y: s * 0.50))
    ctx.strokePath()

    // 4 dispersed truth/motive rays on right (Cyan, Emerald, Amber, Rose)
    let rays: [(CGFloat, CGColor)] = [
        (0.74, CGColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 0.95)),
        (0.58, CGColor(red: 0.20, green: 0.83, blue: 0.60, alpha: 0.95)),
        (0.42, CGColor(red: 0.98, green: 0.75, blue: 0.14, alpha: 0.95)),
        (0.26, CGColor(red: 0.98, green: 0.44, blue: 0.52, alpha: 0.95))
    ]
    ctx.setLineWidth(s * 0.032)
    for (endY, col) in rays {
        ctx.setStrokeColor(col)
        ctx.move(to: CGPoint(x: s * 0.54, y: s * 0.50))
        ctx.addLine(to: CGPoint(x: s * 0.86, y: s * endY))
        ctx.strokePath()
    }

    // Central Logic Prism Triangle
    let prism = CGMutablePath()
    prism.move(to: CGPoint(x: s * 0.48, y: s * 0.76))
    prism.addLine(to: CGPoint(x: s * 0.30, y: s * 0.28))
    prism.addLine(to: CGPoint(x: s * 0.66, y: s * 0.28))
    prism.closeSubpath()

    ctx.addPath(prism)
    ctx.setFillColor(CGColor(red: 0.14, green: 0.22, blue: 0.38, alpha: 0.88))
    ctx.fillPath()

    ctx.addPath(prism)
    ctx.setStrokeColor(CGColor(red: 0.38, green: 0.82, blue: 1.0, alpha: 1.0))
    ctx.setLineWidth(s * 0.026)
    ctx.strokePath()

    let cgImg = ctx.makeImage()!
    let rep = NSBitmapImageRep(cgImage: cgImg)
    return rep.representation(using: .png, properties: [:])!
}

let specs: [(String, Int)] = [
    ("icon_16x16.png", 16),
    ("icon_16x16@2x.png", 32),
    ("icon_32x32.png", 32),
    ("icon_32x32@2x.png", 64),
    ("icon_128x128.png", 128),
    ("icon_128x128@2x.png", 256),
    ("icon_256x256.png", 256),
    ("icon_256x256@2x.png", 512),
    ("icon_512x512.png", 512),
    ("icon_512x512@2x.png", 1024),
]

for (name, px) in specs {
    let data = renderIcon(size: px)
    try data.write(to: URL(fileURLWithPath: "\(outDir)/\(name)"))
}
print("Generated iconset in \(outDir)")
