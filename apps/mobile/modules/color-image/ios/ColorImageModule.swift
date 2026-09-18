import ExpoModulesCore

public class ColorImageModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ColorImage")

    AsyncFunction("preparePhoto") { (uri: String) throws -> [String: Any] in
      try ColorImageNormalizer.prepare(uri: uri)
    }
    .runOnQueue(DispatchQueue.global(qos: .userInitiated))

    AsyncFunction("releasePhoto") { (uri: String) throws in
      try ColorImageNormalizer.release(uri: uri)
    }
    .runOnQueue(DispatchQueue.global(qos: .utility))
  }
}
