import { Component, Input, OnInit, Inject } from '@angular/core';
//declare var faceapi: any;
////"./node_modules/face-api.js/dist/face-api.min.js"
import * as faceapi from 'face-api.js';
import { Observable } from 'rxjs';
import * as canvas from 'canvas';
import { DOCUMENT } from '@angular/common';
import { ToastrService } from 'ngx-toastr';


const ImageData = canvas.ImageData;

faceapi.env.monkeyPatch({
  Canvas: HTMLCanvasElement,
  Image: HTMLImageElement,
  ImageData: ImageData,
  createCanvasElement: () => document.createElement('canvas'),
  createImageElement: () => document.createElement('img')
})

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'face-match';

  private expressions: Observable<any[]>;
 
  public loading: boolean;
 

  //view properties
  doc: Document
  htmlImageEl: HTMLImageElement
  imageCanvas: HTMLCanvasElement

  inputSize = 512;
  scoreThreshold = 0.5;
  withFaceLandmarks = false; //disable face landmark detection
  withBoxes = true;
  
  constructor(@Inject(DOCUMENT) document, private toastr: ToastrService) { 
    this.doc = document;
    this.loading = false;
  }
  isDataLoading = false;

  file: File;

  imageUrl: string | ArrayBuffer =
  "https://bulma.io/images/placeholders/480x480.png";

  imageUrlSecond: string | ArrayBuffer =
  "https://bulma.io/images/placeholders/480x480.png";

  fileName: string = "No file selected";

  counter:number = 0;

  ngOnInit(){
    // give everything a chance to get loaded before starting the animation to reduce choppiness
    setTimeout(() => {
      //load models
      console.log("start loading models")
      this.loadModels();
    }, 1000);

  }


  async loadModels() {
    // load the models
    console.log("loading models")
    this.loading = true;
    const MODEL_URL = './assets/models/'
    
    await faceapi.loadSsdMobilenetv1Model(MODEL_URL)
    await faceapi.loadFaceLandmarkModel(MODEL_URL)
    await faceapi.loadFaceRecognitionModel(MODEL_URL)
    await faceapi.loadFaceExpressionModel(MODEL_URL)

    this.loading = false;
    this.toastr.success('Models Loaded!');
  }





  async onDetectFaces(mode: string) {
    let fullFaceDescriptions: any;
    let fullFaceDescriptionsSecond: any;
    this.loading = true;
    this.isDataLoading = true;
    this.counter=0;
    let faceDOM = this.doc.getElementById('faceMatchDOM');
    if(this.isDataLoading){
      document.body.scrollTop = 0; // For Safari
    document.documentElement.scrollTop = 0
      faceDOM.style.visibility = 'hidden'
      faceDOM.style.opacity ='0';
      faceDOM.style.transition= 'visibility 0s, opacity 0.5s linear';
    }

    //detects faces
    let imageFirst : HTMLImageElement = <HTMLImageElement>this.doc.getElementById("inputImage")
    let imageCanvas:HTMLCanvasElement = <HTMLCanvasElement>this.doc.getElementById("overlayImage")
    let imageFirstSecond : HTMLImageElement = <HTMLImageElement>this.doc.getElementById("inputImageSecond")
    let imageCanvasSecond:HTMLCanvasElement = <HTMLCanvasElement>this.doc.getElementById("overlayImageSecond")
    
    fullFaceDescriptions = await this.detectFaces(imageFirst, imageCanvas)
    fullFaceDescriptionsSecond = await this.detectFaces(imageFirstSecond, imageCanvasSecond)
    await this.faceRecognition(fullFaceDescriptions, imageCanvas, mode)
    this.isDataLoading = false;
    this.loading = false;
    if(!this.isDataLoading){
      faceDOM.style.opacity ='1';
      faceDOM.style.visibility = 'visible'
    }
    return fullFaceDescriptions
  }


  
  public async detectFaces(input: HTMLImageElement, canvas: HTMLCanvasElement) {
    this.counter+=1;
    this.htmlImageEl = <HTMLImageElement>this.doc.getElementById("inputImage");


    let width = input['width'];
    let height = input['height'];
    const displaySize = { width: width, height: height }

    //resize the canvas to match the input image dimension
    faceapi.matchDimensions(canvas, displaySize)

    let fullFaceDescriptions = await faceapi.detectAllFaces(input).withFaceLandmarks().withFaceDescriptors().withFaceExpressions()

    //The returned bounding boxes and landmark positions are relative to the original image / media size. In case the displayed image size does not correspond to the original image size you can simply resize 
    fullFaceDescriptions = faceapi.resizeResults(fullFaceDescriptions, input)

   // faceapi.draw.drawDetections(canvas, fullFaceDescriptions)

    return fullFaceDescriptions;
  }


  public async faceRecognition(fullFaceDescriptions: faceapi.WithFaceExpressions<faceapi.WithFaceDescriptor<faceapi.WithFaceLandmarks<{
    detection: faceapi.FaceDetection;
  }, faceapi.FaceLandmarks68>>>[], canvas: HTMLCanvasElement, mode: string) {
    const labels = ['Person']
    const labeledFaceDescriptors = await Promise.all(
      labels.map(async label => {
        // Second image being used to compare
        let imageSecond: HTMLImageElement = <HTMLImageElement>this.doc.getElementById("inputImageSecond")

        // detect the face with the highest score in the image and compute it's landmarks and face descriptor
       const fullFaceDescription = await faceapi.detectSingleFace(imageSecond).withFaceLandmarks().withFaceDescriptor()
        if (!fullFaceDescription) {
          console.log(`no faces detected for ${label}`)
        }
        const faceDescriptors = [fullFaceDescription.descriptor]
        return new faceapi.LabeledFaceDescriptors(label, faceDescriptors)
      })
    )
    //match the face descriptors of the detected faces from our input image to our reference data
    // 0.6 is a good distance threshold value to judge
    // whether the descriptors match or not
    const maxDescriptorDistance = 0.6

    //match the face descriptors of the detected faces from our input image to our reference data
    const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, maxDescriptorDistance)

    const results = fullFaceDescriptions.map(function (fd) {
      return { faceMatcher: faceMatcher.findBestMatch(fd['descriptor']), faceExpressions: fd['expressions'] }
    })

    results.forEach((bestMatch, i) => {
      let expressions = bestMatch['faceExpressions'];
      let recognize = bestMatch['faceMatcher'].toString()
      let max = Math.max.apply(null, Object.values(expressions))

      const box = fullFaceDescriptions[i]['detection']['box']
      let text = ""
      //Call this function to extract and display face
        this.extractFaceFromBox(<HTMLImageElement>this.doc.getElementById("inputImage"), fullFaceDescriptions[i]['detection']['box']);
        this.extractFaceFromBox(<HTMLImageElement>this.doc.getElementById("inputImageSecond"), fullFaceDescriptions[i]['detection']['box']);
     
      if (mode === "expression") {
        text = recognize + ":" + this.getKeyByValue((expressions), max);
        this.toastr.success(this.getKeyByValue((expressions), max) + " " + recognize);
      } else {
        text = recognize;
      }

      let outputShowData:HTMLImageElement = <HTMLImageElement>this.doc.getElementById("outputImage");
      let para =document.createElement('p');
      //outputShowData.style.marginLeft ='115px'
        para.setAttribute('class','matchResult')
        var media360 =window.matchMedia("(max-width: 360px)")
        var media320 = window.matchMedia("(max-width: 320px)")
        var media375 = window.matchMedia("(max-width: 375px)")
        var media414 = window.matchMedia("(max-width: 414px)")
        
      if(bestMatch['faceMatcher']['_distance'] > maxDescriptorDistance){
        para.append(document.createTextNode(text+' '+ '(Not a match!)'));
        para.style.cssText=`
        color: white;
        width: 59%;
        height: 44px;
        padding: 10px 10px 10px 30px;
        box-sizing: border-box;
        border: 1px solid black;
        border-radius: 20px;
        margin-left: -20px;
        background-color: rgb(234, 96, 93);;
        `
               
        if(media320.matches){
          outputShowData.style.marginLeft ='50px'
          para.style.cssText = `
          color: white;
          width: 100%;
          height: 44px;
          padding: 10px 10px 10px 23px;
          box-sizing: border-box;
          border: 1px solid black;
          border-radius: 20px;
          margin-left: -20px;
          background-color: rgb(234, 96, 93);;          
          `
        }

        else if(media360.matches){
          outputShowData.style.marginLeft ='70px'
          para.style.cssText =`
          color: white;
          width: 100%;
          height: 44px;
          padding: 10px 10px 10px 23px;
          box-sizing: border-box;
          border: 1px solid black;
          border-radius: 20px;
          margin-left: -20px;
          background-color: rgb(234, 96, 93);
          `
        }
        else if(media375.matches){
          outputShowData.style.marginLeft ='75px'
          para.style.cssText =`
          color: white;
          width: 100%;
          height: 44px;
          padding: 10px 10px 10px 23px;
          box-sizing: border-box;
          border: 1px solid black;
          border-radius: 20px;
          margin-left: -34px;
          background-color: rgb(234, 96, 93);         
          `
        }
        else if(media414.matches){
          outputShowData.style.marginLeft ='98px'
          para.style.cssText =`
          color: white;
          width: 100%;
          height: 44px;
          padding: 10px 10px 10px 23px;
          box-sizing: border-box;
          border: 1px solid black;
          border-radius: 20px;
          margin-left: -20px;
          background-color: rgb(234, 96, 93);
          `
        }
        outputShowData.appendChild(para)
      }
      else{
        para.append(document.createTextNode(text+' '+'(Match succesfull!)'));
        para.style.cssText=`
        color: white;
        width: 59%;
        height: 44px;
        padding: 10px 10px 10px 30px;
        box-sizing: border-box;
        border: 1px solid black;
        border-radius: 20px;
        margin-left: -20px;
        background-color:rgb(178, 255, 89);
        `
        
        if(media320.matches){
          outputShowData.style.marginLeft ='50px'
          para.style.cssText =`
          color: white;
          width: 100%;
          height: 44px;
          padding: 10px 10px 10px 23px;
          box-sizing: border-box;
          border: 1px solid black;
          border-radius: 20px;
          margin-left: -20px;
          background-color: rgb(178, 255, 89);          
          `
        }
        else if(media360.matches){
          outputShowData.style.marginLeft ='70px'
          para.style.cssText =`
          color: white;
          width: 100%;
          height: 44px;
          padding: 10px 10px 10px 23px;
          box-sizing: border-box;
          border: 1px solid black;
          border-radius: 20px;
          margin-left: -20px;
          background-color: rgb(178, 255, 89);
          `
        }
        else if(media375.matches){
          outputShowData.style.marginLeft ='75px'
          para.style.cssText =`
          color: white;
          width: 100%;
          height: 44px;
          padding: 10px 10px 10px 23px;
          box-sizing: border-box;
          border: 1px solid black;
          border-radius: 20px;
          margin-left: -34px;
          background-color: rgb(178, 255, 89);          
          `
        }
        else if(media414.matches){
          outputShowData.style.marginLeft ='98px'
          para.style.cssText =`
          color: white;
          width: 100%;
          height: 44px;
          padding: 10px 10px 10px 23px;
          box-sizing: border-box;
          border: 1px solid black;
          border-radius: 20px;
          margin-left: -20px;
          background-color: rgb(178, 255, 89);
          `
        }
        outputShowData.appendChild(para)
      }

      //draw the bounding boxes together with their labels into a canvas to display the results
      const drawBox = new faceapi.draw.DrawBox(box, { label: text })
     // drawBox.draw(canvas)
     
    })
  }

  public getKeyByValue(object, value) {
    return Object.keys(object).find(key => object[key] === value);
  }

   
// This function extract a face from a canvas
  public async extractFaceFromBox(inputImage, box){ 

    this.htmlImageEl =  <HTMLImageElement>this.doc.getElementById("outputImage");
  const regionsToExtract = [
    new faceapi.Rect(box.x, box.y , box.width , box.height)
  ]
  // actually extractFaces is meant to extract face regions from bounding boxes
  // but you can also use it to extract any other region
  const detect = await faceapi.detectAllFaces(inputImage);  
  let faceImages = await faceapi.extractFaces(inputImage, detect)

  let canvas: HTMLCanvasElement;
  if(this.counter === 1){
    canvas = <HTMLCanvasElement>this.doc.getElementById("overlayImage");
    faceapi.matchDimensions(canvas,inputImage);   //inputImage 
    faceImages.forEach(canvas => this.htmlImageEl.append(canvas))
  }
  if(this.counter ===2){
     canvas = <HTMLCanvasElement>this.doc.getElementById("overlayImageSecond");
     faceapi.matchDimensions(canvas,inputImage);
     faceImages.forEach(canvas => this.htmlImageEl.append(canvas))
  }
  faceImages[0].style.height = '150px';
  faceImages[0].style.width = '150px';
  faceImages[0].style.border= '1px solid blue';
  faceImages[0].style.marginRight = '10px';
  if(window.matchMedia("(max-width: 360px)")){
    faceImages[0].style.height = '100px';
  faceImages[0].style.width = '100px';
  }

  this.openDiv();

}



onChange(file: File) {
    if (file) {
      this.fileName = file.name;
      this.file = file;

      const reader = new FileReader();
      reader.readAsDataURL(file);

      reader.onload = event => {
        this.imageUrl = reader.result;
      };
    }
  }

  onChangeSecond(file: File) {
    if (file) {
      this.fileName = file.name;
      this.file = file;

      const reader = new FileReader();
      reader.readAsDataURL(file);

      reader.onload = event => {
        this.imageUrlSecond = reader.result;
      };
    }
  }


  openDiv(){
    let faceMatch = this.doc.getElementById('card-edit')
    faceMatch.style.display ='block';
    document.body.scrollTop = 0; // For Safari
    document.documentElement.scrollTop = 0
  }
  onClose(){
    let outputShowData =  <HTMLImageElement>this.doc.getElementById("outputImage");
    var child = outputShowData.lastElementChild
    while (child){
      outputShowData.removeChild(child);
      child = outputShowData.lastElementChild;
    }
    let faceMatch = this.doc.getElementById('card-edit')
    faceMatch.style.display ='none';
  }
 

}
